import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Flag, Loader2, Reply, Send, Shield, UserX, X } from 'lucide-react';
import type { DirectChatData, DirectChatMessage, MeetupChatReaction } from '../../types';
import { CASUAL_PACE_INFO } from '../../types';
import { api } from '../../services/api';
import { askBotAccess } from '../../services/botAccess';
import { telegramService } from '../../services/telegram';
import { useOpenUser } from '../../context/openUser';
import { thumb } from '../../utils/thumb';
import { BottomSheet } from '../ui/BottomSheet';
import { ReportSheet } from './ReportSheet';
import { CoinFlip } from './CoinFlip';
import { coinSeen, markCoinSeen } from './ConnectSheets';
import { HELLO_TEXTS as H } from '../../texts/hello';

export interface DirectChatSheetProps {
  peerId: number;
  peerName?: string;
  peerAvatarUrl?: string;
  myAvatarUrl?: string;
  onClose: () => void;
  onRead?: (peerId: number) => void;
  onMessageSent?: (peerId: number, text: string) => void;
  onGoTogether?: (peerId: number) => void;
  onDuel?: (peerId: number, name: string) => void;
  onBlockedOrReported?: (peerId: number) => void;
}

const MINSK_TZ = 'Europe/Minsk';
const GROUP_WINDOW_MS = 5 * 60_000;
const CHAT_REACTIONS = ['👍', '❤️', '😂', '🔥', '🙏'] as const;

const hhmm = (at: string) =>
  new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: MINSK_TZ });

const dayKey = (at: string) =>
  new Date(at).toLocaleDateString('en-CA', { timeZone: MINSK_TZ });

const dayLabel = (at: string) => {
  const key = dayKey(at);
  const now = new Date();
  if (key === dayKey(now.toISOString())) return 'Сегодня';
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (key === dayKey(yesterday.toISOString())) return 'Вчера';
  return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: MINSK_TZ });
};

const TINTS = [
  'bg-zine-terracotta/15 text-zine-terracotta',
  'bg-zine-sage/20 text-zine-sage',
  'bg-zine-mustard/20 text-zine-mustardInk',
  'bg-zine-sky/15 text-zine-sky',
  'bg-zine-plum/15 text-zine-plum'
];

const toggleLocalReaction = (list: MeetupChatReaction[] | undefined, emoji: string): MeetupChatReaction[] => {
  const next = (list || []).map((r) => ({ ...r }));
  const found = next.find((r) => r.emoji === emoji);
  if (found) {
    if (found.mine) {
      found.mine = false;
      found.count = Math.max(0, found.count - 1);
    } else {
      found.mine = true;
      found.count += 1;
    }
    return next.filter((r) => r.count > 0);
  }
  return [...next, { emoji, count: 1, mine: true }];
};

const ChatAvatar: React.FC<{
  src?: string;
  name: string;
  userId?: number;
  size?: string;
  onClick?: () => void;
}> = ({ src, name, userId = 0, size = 'w-9 h-9 text-sm2', onClick }) => {
  const tint = TINTS[Math.abs(userId) % TINTS.length];
  const imgSrc = thumb(src);
  const inner = imgSrc ? (
    <img src={imgSrc} alt={name} className={`${size} rounded-full object-cover bg-zine-card shrink-0`} loading="lazy" />
  ) : (
    <span className={`${size} rounded-full font-bold flex items-center justify-center shrink-0 ${tint}`}>
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
  if (!onClick) return inner;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Открыть анкету: ${name}`}
      className="shrink-0 rounded-full active:scale-95 transition-transform cursor-pointer"
    >
      {inner}
    </button>
  );
};

export const DirectChatSheet: React.FC<DirectChatSheetProps> = ({
  peerId,
  peerName,
  peerAvatarUrl,
  myAvatarUrl,
  onClose,
  onRead,
  onMessageSent,
  onGoTogether,
  onDuel,
  onBlockedOrReported
}) => {
  const [data, setData] = useState<DirectChatData | null>(null);
  const [older, setOlder] = useState<DirectChatMessage[]>([]);
  const [olderBefore, setOlderBefore] = useState<string | null>();
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingPhrase, setSendingPhrase] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<DirectChatMessage | null>(null);
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [animateCoin] = useState(() => !coinSeen(peerId));

  const openUser = useOpenUser();
  const retrySend = useRef<{ text: string; replyToId?: string; clientId: string }>();
  const requestId = useRef(0);
  const mounted = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const knownLast = useRef<string>();
  const scrollToNew = useRef(true);

  const earlier = olderBefore === undefined ? data?.before : olderBefore;

  const refresh = useCallback(async (quiet = false) => {
    const id = ++requestId.current;
    try {
      const next = await api.getDirectChat(peerId, undefined, quiet);
      if (!mounted.current || id !== requestId.current) return;
      const marker = bottom.current;
      const scroller = marker?.closest('.overflow-y-auto');
      scrollToNew.current = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 100;
      setData(next);
      setError('');
      if (next.firstMove) markCoinSeen(peerId);
      onRead?.(peerId);
    } catch (err: any) {
      if (!mounted.current || id !== requestId.current) return;
      if (!quiet || [401, 403, 404, 410].includes(err?.status)) {
        setData(null);
        setOlder([]);
        setOlderBefore(undefined);
        setError(err?.message || 'Не получилось загрузить чат. Попробуй ещё раз');
      }
    }
  }, [peerId, onRead]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden && !reportOpen && !safetyOpen) void refresh(true);
    }, 10000);
    return () => {
      mounted.current = false;
      requestId.current++;
      window.clearInterval(timer);
    };
  }, [refresh, reportOpen, safetyOpen]);

  const latest = data?.messages.length ? data.messages[data.messages.length - 1].id : undefined;
  useEffect(() => {
    if (latest && knownLast.current !== latest && scrollToNew.current) {
      bottom.current?.scrollIntoView({ block: 'end' });
    }
    knownLast.current = latest;
  }, [latest]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [text]);

  const patchMessageReactions = (messageId: string, updater: (prev?: MeetupChatReaction[]) => MeetupChatReaction[]) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) => (m.id === messageId ? { ...m, reactions: updater(m.reactions) } : m))
      };
    });
    setOlder((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updater(m.reactions) } : m)));
  };

  const handleReact = async (m: DirectChatMessage, emoji: string) => {
    const key = `${m.id}:${emoji}`;
    if (reactingKey === key) return;
    setReactingKey(key);
    setActiveMessageId(null);
    setSendError('');
    telegramService.haptic('selection');
    const prevReactions = m.reactions;
    patchMessageReactions(m.id, (curr) => toggleLocalReaction(curr, emoji));
    try {
      const res = await api.toggleDirectChatReaction(peerId, m.id, emoji);
      if (mounted.current && res?.reactions) {
        patchMessageReactions(m.id, () => res.reactions);
      }
    } catch (err: any) {
      if (!mounted.current) return;
      patchMessageReactions(m.id, () => prevReactions || []);
      telegramService.haptic('error');
      setSendError(err?.message || 'Не получилось поставить реакцию');
    } finally {
      if (mounted.current) setReactingKey(null);
    }
  };

  const loadEarlier = async () => {
    if (!earlier || loadingEarlier) return;
    setLoadingEarlier(true);
    setSendError('');
    try {
      const page = await api.getDirectChat(peerId, earlier);
      if (mounted.current) {
        setOlder((prev) => [...page.messages, ...prev].filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i));
        setOlderBefore(page.before);
      }
    } catch (err: any) {
      if (mounted.current) setSendError(err?.message || 'Не получилось загрузить предыдущие сообщения');
    } finally {
      if (mounted.current) setLoadingEarlier(false);
    }
  };

  const sendText = async (raw: string, fromPhrase = false) => {
    const clean = raw.trim();
    if (!clean || sending) return;
    setSending(true);
    if (fromPhrase) setSendingPhrase(clean);
    setSendError('');
    const replyToId = fromPhrase ? undefined : replyingTo?.id;
    try {
      if (retrySend.current?.text !== clean || retrySend.current?.replyToId !== replyToId) {
        retrySend.current = { text: clean, replyToId, clientId: crypto.randomUUID() };
      }
      const res = await api.sendDirectChatMessage(peerId, clean, retrySend.current.clientId, replyToId);
      if (!mounted.current) return;
      retrySend.current = undefined;
      if (!fromPhrase) setText('');
      setReplyingTo(null);
      setActiveMessageId(null);
      telegramService.haptic(fromPhrase ? 'light' : 'success');
      void askBotAccess();
      onMessageSent?.(peerId, clean);
      if (res?.message) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                phrases: [],
                messages: prev.messages.some((m) => m.id === res.message!.id)
                  ? prev.messages
                  : [...prev.messages, res.message!]
              }
            : prev
        );
      } else {
        await refresh();
      }
      bottom.current?.scrollIntoView({ block: 'end' });
    } catch (err: any) {
      if (!mounted.current) return;
      telegramService.haptic('error');
      setSendError(err?.message || 'Сообщение не ушло. Попробуй ещё раз');
      if (err?.status === 403) void refresh(true);
    } finally {
      if (mounted.current) {
        setSending(false);
        setSendingPhrase(null);
      }
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendText(text, false);
  };

  const handleBlock = async () => {
    if (blocking) return;
    setBlocking(true);
    setSendError('');
    try {
      await api.reactToUser(peerId, 'dislike');
      telegramService.haptic('warning');
      onBlockedOrReported?.(peerId);
      onClose();
    } catch (err: any) {
      if (mounted.current) {
        telegramService.haptic('error');
        setSendError(err?.message || 'Не получилось скрыть пользователя. Попробуй ещё раз');
      }
    } finally {
      if (mounted.current) setBlocking(false);
    }
  };

  const startReply = (m: DirectChatMessage) => {
    telegramService.haptic('light');
    setReplyingTo(m);
    setActiveMessageId(null);
    window.setTimeout(() => textareaRef.current?.focus(), 40);
  };

  const displayName = data?.peer.firstName || peerName || 'Чат';
  const displayAvatar = data?.peer.avatarUrl ?? peerAvatarUrl;
  const recentIds = new Set(data?.messages.map((m) => m.id));
  const messages = data ? [...older.filter((m) => !recentIds.has(m.id)), ...data.messages] : [];
  const ttlDays = data?.expiresInDays || 7;

  return (
    <>
      <BottomSheet
        title="Личный чат"
        onClose={onClose}
        footer={
          data?.canSend ? (
            <form onSubmit={handleSubmit}>
              {sendError && (
                <p role="alert" className="mb-2 text-sm2 font-semibold text-zine-danger">
                  {sendError}
                </p>
              )}
              {replyingTo && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-r-zine-sm border-l-2 border-zine-terracotta bg-zine-card px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-cap font-bold text-zine-terracotta">
                      <Reply size={13} className="shrink-0" />
                      <span className="truncate">Ответ: {replyingTo.mine ? 'Ты' : replyingTo.name}</span>
                    </p>
                    <p className="truncate text-cap text-zine-inkMuted">{replyingTo.text}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Отменить ответ"
                    onClick={() => setReplyingTo(null)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zine-inkMuted active:bg-zine-border cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 pb-1">
                <div className="relative flex-1 min-w-0">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Напиши сообщение…"
                    aria-label="Сообщение"
                    maxLength={1000}
                    rows={1}
                    disabled={sending}
                    className="field min-h-[46px] max-h-28 w-full rounded-2xl py-2.5 text-base leading-snug"
                  />
                  {text.length > 850 && (
                    <span className="pointer-events-none absolute right-3 bottom-1.5 text-[11px] font-semibold text-zine-inkMuted">
                      {1000 - text.length}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  aria-label="Отправить сообщение"
                  disabled={sending || !text.trim()}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-zine-terracotta text-white transition-transform active:scale-[0.95] disabled:opacity-40 cursor-pointer"
                >
                  {sending && !sendingPhrase ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
                </button>
              </div>
            </form>
          ) : undefined
        }
      >
        <div className="space-y-3 pt-1">
          {/* Шапка собеседника и быстрые действия */}
          <div className="rounded-zine border border-zine-border/70 bg-zine-card/80 p-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  telegramService.haptic('light');
                  openUser(peerId);
                }}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-80 cursor-pointer"
              >
                <ChatAvatar src={displayAvatar} name={displayName} userId={peerId} size="w-11 h-11 text-body" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-body font-bold text-zine-ink">
                    {displayName}
                    {data?.peer.age ? `, ${data.peer.age}` : ''}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-cap text-zine-inkMuted">
                    <Clock size={12} className="shrink-0" />
                    <span className="truncate">Чат хранится {ttlDays} дней тишины</span>
                  </span>
                </span>
              </button>

              <button
                type="button"
                aria-label="Безопасность и жалобы"
                aria-expanded={safetyOpen}
                onClick={() => {
                  telegramService.haptic('light');
                  setSafetyOpen((v) => !v);
                  setConfirmBlock(false);
                }}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-transform active:scale-[0.95] cursor-pointer ${
                  safetyOpen
                    ? 'border-zine-terracotta bg-zine-terracotta/15 text-zine-terracotta'
                    : 'border-zine-border bg-zine-cardElevated text-zine-inkMuted'
                }`}
              >
                <Shield size={19} />
              </button>
            </div>

            {/* Компактные быстрые действия: На сходку и Сыграть */}
            {(onGoTogether || (onDuel && data?.canPlay)) && (
              <div className="mt-2.5 flex gap-2">
                {onGoTogether && (
                  <button
                    type="button"
                    onClick={() => {
                      telegramService.haptic('light');
                      onGoTogether(peerId);
                    }}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border border-zine-terracotta/40 bg-zine-cardElevated px-3 text-sm2 font-bold text-zine-terracotta transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    <span>👯 На сходку</span>
                  </button>
                )}
                {onDuel && data?.canPlay && (
                  <button
                    type="button"
                    onClick={() => {
                      telegramService.haptic('light');
                      onDuel(peerId, displayName);
                    }}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-zine-mustard/20 px-3 text-sm2 font-bold text-zine-ink transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    <span>🎲 Сыграть</span>
                  </button>
                )}
              </div>
            )}

            {/* Встроенная панель безопасности (блокировка в один шаг или жалоба) */}
            {safetyOpen && (
              <div className="mt-2.5 rounded-zine-sm border border-zine-border bg-zine-cardElevated p-3">
                {confirmBlock ? (
                  <div>
                    <p className="text-sm2 font-semibold text-zine-ink">
                      Заблокировать и скрыть {displayName}? Вы больше не увидите друг друга, и чат закроется.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        disabled={blocking}
                        onClick={() => void handleBlock()}
                        className="flex min-h-[44px] flex-1 items-center justify-center rounded-zine-sm bg-zine-danger px-3 text-sm2 font-bold text-white transition-transform active:scale-[0.98] cursor-pointer"
                      >
                        {blocking ? <Loader2 size={18} className="animate-spin" /> : 'Да, скрыть'}
                      </button>
                      <button
                        type="button"
                        disabled={blocking}
                        onClick={() => setConfirmBlock(false)}
                        className="flex min-h-[44px] flex-1 items-center justify-center rounded-zine-sm border border-zine-border bg-zine-card px-3 text-sm2 font-semibold text-zine-ink transition-transform active:scale-[0.98] cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        telegramService.haptic('warning');
                        setConfirmBlock(true);
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-zine-sm bg-zine-card px-3.5 text-left text-sm2 font-semibold text-zine-ink transition-transform active:scale-[0.98] cursor-pointer"
                    >
                      <UserX size={17} className="shrink-0 text-zine-inkMuted" />
                      <span>Заблокировать и скрыть</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        telegramService.haptic('warning');
                        setSafetyOpen(false);
                        setReportOpen(true);
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-zine-sm bg-zine-danger/10 px-3.5 text-left text-sm2 font-bold text-zine-danger transition-transform active:scale-[0.98] cursor-pointer"
                    >
                      <Flag size={17} className="shrink-0" />
                      <span>Пожаловаться</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Приватная карточка совпавших форматов (видна только вам двоим) */}
          {data?.comfort && (data.comfort.mutualSerious || data.comfort.mutualCasual) && (
            <div className="rounded-zine-sm border border-[#C77D86]/35 bg-[#C77D86]/10 px-3.5 py-2.5 space-y-1.5">
              {data.comfort.mutualSerious && (
                <p className="text-sm2 font-semibold text-zine-ink leading-snug">
                  ❤️ Вы оба открыты к серьёзным отношениям
                </p>
              )}
              {data.comfort.mutualCasual && (
                <div className="space-y-0.5">
                  <p className="text-sm2 font-semibold text-zine-ink leading-snug">
                    🔥 У вас совпал формат: близость без обязательств
                  </p>
                  {data.comfort.peerCasualPace && (
                    <p className="text-cap text-zine-inkMuted leading-snug">
                      Темп {displayName}: {CASUAL_PACE_INFO[data.comfort.peerCasualPace].emoji}{' '}
                      {CASUAL_PACE_INFO[data.comfort.peerCasualPace].label}
                    </p>
                  )}
                </div>
              )}
              <p className="text-[11px] text-zine-inkMuted">
                Эту пометку видите только вы вдвоём
              </p>
            </div>
          )}

          {/* Состояние ошибки */}
          {error && (
            <div role="alert" className="rounded-zine border border-zine-border bg-zine-card p-5 text-center">
              <p className="text-body text-zine-ink">{error}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-3 min-h-[44px] rounded-full bg-zine-terracotta/15 px-5 text-sm2 font-bold text-zine-terracotta transition-transform active:scale-[0.98] cursor-pointer"
              >
                Попробовать ещё раз
              </button>
            </div>
          )}

          {/* Состояние загрузки: тёплые скелетоны облачков */}
          {!data && !error && (
            <div aria-label="Загружаю чат" className="space-y-3.5 py-3">
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zine-card" />
                <div className="h-14 w-3/4 animate-pulse rounded-2xl rounded-bl-md bg-zine-card" />
              </div>
              <div className="ml-auto h-12 w-3/5 animate-pulse rounded-2xl rounded-br-md bg-zine-sage/15" />
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zine-card" />
                <div className="h-16 w-4/5 animate-pulse rounded-2xl rounded-bl-md bg-zine-card" />
              </div>
            </div>
          )}

          {/* Подгрузка более ранних сообщений */}
          {data && earlier && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadEarlier}
                disabled={loadingEarlier}
                className="min-h-[44px] rounded-full bg-zine-card px-4 text-sm2 font-bold text-zine-terracotta transition-transform active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {loadingEarlier ? 'Загружаю…' : 'Предыдущие сообщения'}
              </button>
            </div>
          )}

          {/* Пустой чат: монетка + 3 готовые стартовые фразы */}
          {data && messages.length === 0 && (
            <div className="rounded-zine border border-zine-border/70 bg-zine-card p-4">
              {data.firstMove && (
                <div className="mb-4">
                  <CoinFlip
                    result={data.firstMove}
                    me={{ avatarUrl: myAvatarUrl, label: H.you }}
                    them={{ avatarUrl: displayAvatar, label: displayName }}
                    text={data.firstMove === 'me' ? H.coinMe : H.coinThem(displayName)}
                    animate={animateCoin}
                    size={animateCoin ? 96 : 72}
                  />
                </div>
              )}

              <p className="font-serif text-body font-bold text-zine-ink text-center">
                С чего начать разговор?
              </p>
              <p className="mt-1 text-center text-sm2 text-zine-inkMuted">
                Нажми на фразу, чтобы сразу отправить её, или напиши своё сообщение ниже.
              </p>

              {data.phrases.length > 0 && (
                <div className="mt-3.5 space-y-2">
                  {data.phrases.map((phrase) => {
                    const isThisSending = sendingPhrase === phrase;
                    return (
                      <button
                        key={phrase}
                        type="button"
                        disabled={sending}
                        onClick={() => void sendText(phrase, true)}
                        className="flex min-h-[52px] w-full items-center gap-3 rounded-zine-sm border border-zine-border bg-zine-cardElevated px-4 py-3 text-left text-body text-zine-ink transition-transform active:scale-[0.98] cursor-pointer disabled:opacity-60"
                      >
                        <span className="flex-1 leading-snug">{phrase}</span>
                        {isThisSending ? (
                          <Loader2 size={18} className="shrink-0 animate-spin text-zine-terracotta" />
                        ) : (
                          <Send size={17} className="shrink-0 text-zine-terracotta" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="mt-3.5 text-center text-cap text-zine-inkMuted">
                Личный Telegram скрыт - общайтесь спокойно прямо здесь
              </p>
            </div>
          )}

          {/* Лента сообщений */}
          {data && messages.length > 0 && (
            <div className="space-y-1 pb-1">
              <p className="text-center text-[11px] text-zine-inkMuted">
                Нажми на сообщение, чтобы ответить или поставить реакцию
              </p>
              {messages.map((m, idx) => {
                const prev = idx > 0 ? messages[idx - 1] : null;
                const next = idx < messages.length - 1 ? messages[idx + 1] : null;
                const showDate = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                const sameAsPrev =
                  !showDate &&
                  prev !== null &&
                  prev.senderId === m.senderId &&
                  new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
                const sameAsNext =
                  next !== null &&
                  dayKey(next.createdAt) === dayKey(m.createdAt) &&
                  next.senderId === m.senderId &&
                  new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() < GROUP_WINDOW_MS;
                const isActive = activeMessageId === m.id;
                const reactions = m.reactions || [];

                return (
                  <React.Fragment key={m.id}>
                    {showDate && (
                      <div className="flex justify-center py-2">
                        <span className="rounded-full bg-zine-card px-3 py-1 text-cap font-semibold text-zine-inkMuted">
                          {dayLabel(m.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={sameAsPrev ? 'mt-0.5' : 'mt-3'}>
                      <div className={`flex items-end gap-2 ${m.mine ? 'justify-end' : 'justify-start'}`}>
                        {!m.mine && (
                          sameAsNext ? (
                            <span className="w-8 shrink-0" aria-hidden />
                          ) : (
                            <ChatAvatar
                              src={m.avatarUrl || displayAvatar}
                              name={m.name}
                              userId={m.senderId}
                              size="w-8 h-8 text-cap"
                              onClick={() => {
                                telegramService.haptic('light');
                                openUser(m.senderId);
                              }}
                            />
                          )
                        )}
                        <div className={`min-w-0 max-w-[82%] flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                          <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={isActive}
                            onClick={() => {
                              telegramService.haptic('light');
                              setActiveMessageId((curr) => (curr === m.id ? null : m.id));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveMessageId((curr) => (curr === m.id ? null : m.id));
                              }
                            }}
                            className={`w-full rounded-2xl px-3.5 py-2 text-left transition-transform active:scale-[0.99] cursor-pointer ${
                              m.mine
                                ? 'rounded-br-md border border-zine-sage/30 bg-zine-sage/20'
                                : 'rounded-bl-md border border-zine-border/60 bg-zine-card'
                            } ${isActive ? 'ring-2 ring-zine-terracotta/40' : ''}`}
                          >
                            {m.replyTo && (
                              <div className="mb-1.5 rounded-r-lg border-l-2 border-zine-terracotta/70 bg-black/[0.04] dark:bg-white/[0.07] px-2.5 py-1">
                                <p className="truncate text-[11px] font-bold text-zine-terracotta">{m.replyTo.senderName}</p>
                                <p className="truncate text-cap text-zine-inkMuted">{m.replyTo.text}</p>
                              </div>
                            )}
                            <p className="whitespace-pre-wrap break-words text-body leading-snug text-zine-ink">{m.text}</p>
                            <p className="mt-1 text-right text-[11px] leading-none text-zine-inkMuted">{hhmm(m.createdAt)}</p>
                          </div>

                          {/* Реакции под сообщением */}
                          {reactions.length > 0 && (
                            <div className={`mt-1 flex flex-wrap gap-1 ${m.mine ? 'justify-end' : 'justify-start'}`}>
                              {reactions.map((r) => (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={() => void handleReact(m, r.emoji)}
                                  className={`inline-flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-cap font-bold transition-transform active:scale-95 cursor-pointer ${
                                    r.mine
                                      ? 'border-zine-terracotta/50 bg-zine-terracotta/15 text-zine-ink'
                                      : 'border-zine-border bg-zine-card text-zine-inkMuted'
                                  }`}
                                >
                                  <span>{r.emoji}</span>
                                  <span>{r.count}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Панель быстрых действий по тапу на сообщение */}
                          {isActive && (
                            <div
                              ref={(el) => {
                                if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                              }}
                              className="mt-1.5 rounded-zine-sm border border-zine-border bg-zine-cardElevated p-2 shadow-sm"
                            >
                              <div className="flex items-center gap-1">
                                {CHAT_REACTIONS.map((emoji) => {
                                  const active = reactions.some((r) => r.emoji === emoji && r.mine);
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      aria-label={`Реакция ${emoji}`}
                                      onClick={() => void handleReact(m, emoji)}
                                      className={`grid h-10 w-10 place-items-center rounded-full text-[19px] transition-transform active:scale-90 cursor-pointer ${
                                        active ? 'bg-zine-terracotta/15 ring-1 ring-zine-terracotta' : 'active:bg-zine-card'
                                      }`}
                                    >
                                      {emoji}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mt-1.5 flex items-center gap-2 border-t border-zine-border/70 pt-1.5">
                                <button
                                  type="button"
                                  onClick={() => startReply(m)}
                                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-zine-card px-3 text-cap font-bold text-zine-ink transition-transform active:scale-[0.98] cursor-pointer"
                                >
                                  <Reply size={15} className="text-zine-terracotta" />
                                  <span>Ответить</span>
                                </button>
                                {!m.mine && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMessageId(null);
                                      setReportOpen(true);
                                    }}
                                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-zine-card px-3 text-cap font-bold text-zine-inkMuted active:text-zine-danger cursor-pointer"
                                  >
                                    <Flag size={14} />
                                    <span>Пожаловаться</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          <div ref={bottom} />
        </div>
      </BottomSheet>

      {reportOpen && (
        <ReportSheet
          targetType="user"
          targetId={peerId}
          targetName={displayName}
          onClose={() => setReportOpen(false)}
          onReported={() => {
            onBlockedOrReported?.(peerId);
            onClose();
          }}
          contextNote="Модератор увидит последние 10 сообщений этого диалога, чтобы справедливо разобраться. Человек сразу скроется для тебя."
          submit={async (reason, comment) => {
            await api.reportDirectChat(peerId, reason, comment);
          }}
          successText="Жалоба отправлена. Этот человек и чат с ним больше не будут тебе показываться."
        />
      )}
    </>
  );
};

/**
 * Шторка-пояснение по кнопке «?» рядом с «💬 Написать» в «На связи».
 */
export const DirectChatRulesSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <BottomSheet title="Как устроен личный чат" onClose={onClose}>
    <div className="space-y-3.5">
      {[
        {
          emoji: '🤝',
          title: 'Чат дружбы и уважения',
          text: 'ГУЛЯЙ! создан для тёплого общения, прогулок и компаний. Уважай чужие границы и спокойное «нет», не дави и не навязывайся. Если собеседник не отвечает, это нормально.'
        },
        {
          emoji: '🔒',
          title: 'Личный Telegram скрыт',
          text: 'Вы переписываетесь прямо здесь, внутри приложения. Свой ник в Telegram каждый даёт сам, только если захочет. Переписка хранится 7 дней после последнего сообщения.'
        },
        {
          emoji: '❤️',
          title: 'Если ищешь отношения или близость',
          text: 'Такие форматы возможны только по взаимному согласию. Отметь их в своей анкете в разделе «Комфортно»: серьёзные отношения увидят только те, кто выбрал то же самое, а близость раскроется только здесь в чате после взаимного 👋, если совпало у обоих.'
        },
        {
          emoji: '🛡',
          title: 'Всегда можно закрыть диалог',
          text: 'В шапке чата есть кнопка щита: можно в один шаг скрыть человека или пожаловаться. При жалобе модератор увидит последние 10 сообщений этого диалога, чтобы справедливо разобраться.'
        }
      ].map((item) => (
        <div key={item.title} className="flex gap-3 rounded-zine-sm bg-zine-card p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zine-cardElevated text-[20px]">
            {item.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-body font-bold text-zine-ink leading-snug">{item.title}</p>
            <p className="mt-1 text-sm2 text-zine-inkMuted leading-snug">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
    <button
      type="button"
      onClick={() => {
        telegramService.haptic('light');
        onClose();
      }}
      className="mt-5 w-full min-h-[48px] rounded-full bg-zine-terracotta text-white text-body font-bold active:scale-[0.98] transition-transform cursor-pointer"
    >
      Понятно
    </button>
  </BottomSheet>
);

/**
 * Смахиваемое уведомление сверху экрана внутри приложения при новом сообщении в личном чате.
 */
export interface DirectChatToastData {
  peerId: number;
  name: string;
  avatarUrl?: string;
  preview: string;
}

export const DirectChatToast: React.FC<{
  toast: DirectChatToastData | null;
  onOpen: (toast: DirectChatToastData) => void;
  onDismiss: () => void;
}> = ({ toast, onOpen, onDismiss }) => (
  <AnimatePresence>
    {toast && (
      <motion.div
        key={`${toast.peerId}:${toast.preview}`}
        initial={{ y: -96, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        drag="y"
        dragConstraints={{ top: -120, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          if (info.offset.y < -36 || info.velocity.y < -250) {
            telegramService.haptic('light');
            onDismiss();
          }
        }}
        className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+12px)] z-[85] mx-auto max-w-[400px]"
      >
        <div className="flex items-center gap-2.5 rounded-zine border-2 border-zine-terracotta/50 bg-zine-cardElevated p-2.5 shadow-zine-float">
          <button
            type="button"
            onClick={() => {
              telegramService.haptic('medium');
              onOpen(toast);
            }}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-80 cursor-pointer"
          >
            <ChatAvatar src={toast.avatarUrl} name={toast.name} userId={toast.peerId} size="w-11 h-11 text-body" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm2 font-bold text-zine-ink">
                💬 {toast.name} пишет тебе
              </span>
              <span className="block truncate text-cap text-zine-inkMuted">
                {toast.preview || 'Нажми, чтобы открыть чат'}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Закрыть уведомление"
            onClick={() => {
              telegramService.haptic('light');
              onDismiss();
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zine-inkMuted active:bg-zine-card cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

