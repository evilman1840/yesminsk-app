import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flag, Loader2, MessageCircle, Reply, Send, ShieldAlert, X } from 'lucide-react';
import type { MeetupChatData, MeetupChatKind, MeetupChatMessage, MeetupChatReaction } from '../../types';
import { api } from '../../services/api';
import { askBotAccess } from '../../services/botAccess';
import { telegramService } from '../../services/telegram';
import { useOpenUser } from '../../context/openUser';
import { thumb } from '../../utils/thumb';
import { BottomSheet } from '../ui/BottomSheet';
import { ReportSheet } from './ReportSheet';

type Props = {
  eventId: string;
  kind: MeetupChatKind;
  eventTitle?: string;
  askerId?: number;
  avatars?: Record<number, string>;
  onClose: () => void;
};

const MINSK_TZ = 'Europe/Minsk';
const GROUP_WINDOW_MS = 5 * 60_000;
const CHAT_REACTIONS = ['👍', '❤️', '😂', '🔥', '🙏'] as const;

const hhmm = (at: string) =>
  new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: MINSK_TZ });

const closeTime = (at: string) =>
  new Date(at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: MINSK_TZ });

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
}> = ({ src, name, userId = 0, size = 'w-8 h-8 text-cap', onClick }) => {
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

export function MeetupChatSheet({ askerId: initialAskerId, ...props }: Props) {
  const [askerId, setAskerId] = useState(initialAskerId);
  return (
    <ChatView
      key={`${props.eventId}:${props.kind}:${askerId ?? ''}`}
      {...props}
      askerId={askerId}
      onChoose={setAskerId}
    />
  );
}

function ChatView({ eventId, kind, eventTitle, askerId, avatars, onClose, onChoose }: Props & { onChoose: (id?: number) => void }) {
  const [data, setData] = useState<MeetupChatData | null>(null);
  const [older, setOlder] = useState<MeetupChatMessage[]>([]);
  const [olderBefore, setOlderBefore] = useState<string | null>();
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<MeetupChatMessage | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<MeetupChatMessage | null>(null);
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const openUser = useOpenUser();
  const retrySend = useRef<{ text: string; replyToId?: string; clientId: string }>();
  const requestId = useRef(0);
  const mounted = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const knownLast = useRef<string>();
  const scrollToNew = useRef(true);
  const list = data && 'threads' in data ? data.threads : null;
  const thread = data && 'messages' in data ? data : null;
  const earlier = olderBefore === undefined ? thread?.before : olderBefore;

  const refresh = useCallback(async (quiet = false) => {
    const id = ++requestId.current;
    try {
      const next = await api.getMeetupChat(eventId, kind, askerId, undefined, quiet);
      if (!mounted.current || id !== requestId.current) return;
      const marker = bottom.current;
      const scroller = marker?.closest('.overflow-y-auto');
      scrollToNew.current = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 100;
      setData(next);
      setError('');
    } catch (err: any) {
      if (!mounted.current || id !== requestId.current) return;
      if (!quiet || [401, 403, 404, 410].includes(err.status)) {
        setData(null);
        setOlder([]);
        setOlderBefore(undefined);
        setError(err.status === 404 ? 'Эта переписка сейчас недоступна' : (err.message || 'Не получилось загрузить переписку'));
      }
    }
  }, [eventId, kind, askerId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden && !reporting) void refresh(true);
    }, 12000);
    return () => {
      mounted.current = false;
      requestId.current++;
      window.clearInterval(timer);
    };
  }, [refresh, reporting]);

  const latest = thread?.messages.length ? thread.messages[thread.messages.length - 1].id : undefined;
  useEffect(() => {
    if (latest && knownLast.current !== latest && scrollToNew.current) bottom.current?.scrollIntoView({ block: 'end' });
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
      if (!prev || !('messages' in prev)) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) => (m.id === messageId ? { ...m, reactions: updater(m.reactions) } : m))
      };
    });
    setOlder((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updater(m.reactions) } : m)));
  };

  const handleReact = async (m: MeetupChatMessage, emoji: string) => {
    if (data?.chatPaused) return;
    const key = `${m.id}:${emoji}`;
    if (reactingKey === key) return;
    setReactingKey(key);
    setActiveMessageId(null);
    setSendError('');
    telegramService.haptic('selection');
    const prevReactions = m.reactions;
    patchMessageReactions(m.id, (curr) => toggleLocalReaction(curr, emoji));
    try {
      const res = await api.toggleMeetupChatReaction(eventId, m.id, kind, emoji, askerId);
      if (mounted.current && res?.reactions) {
        patchMessageReactions(m.id, () => res.reactions);
      }
    } catch (err: any) {
      if (!mounted.current) return;
      patchMessageReactions(m.id, () => prevReactions || []);
      telegramService.haptic('error');
      setSendError(err.message || 'Не получилось поставить реакцию');
      if (err.status === 403) void refresh(true);
    } finally {
      if (mounted.current) setReactingKey(null);
    }
  };

  const loadEarlier = async () => {
    if (!earlier || loadingEarlier) return;
    setLoadingEarlier(true);
    setSendError('');
    try {
      const page = await api.getMeetupChat(eventId, kind, askerId, earlier);
      if (mounted.current && 'messages' in page) {
        setOlder((prev) => [...page.messages, ...prev].filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i));
        setOlderBefore(page.before);
      }
    } catch (err: any) {
      if (mounted.current) setSendError(err.message || 'Не получилось загрузить предыдущие сообщения');
    } finally {
      if (mounted.current) setLoadingEarlier(false);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setSendError('');
    const replyToId = replyingTo?.id;
    try {
      if (retrySend.current?.text !== clean || retrySend.current?.replyToId !== replyToId) {
        retrySend.current = { text: clean, replyToId, clientId: crypto.randomUUID() };
      }
      await api.sendMeetupChatMessage(eventId, kind, clean, retrySend.current.clientId, askerId, replyToId);
      if (!mounted.current) return;
      retrySend.current = undefined;
      setText('');
      setReplyingTo(null);
      setActiveMessageId(null);
      telegramService.haptic('success');
      if (kind === 'question') void askBotAccess();
      await refresh();
      bottom.current?.scrollIntoView({ block: 'end' });
    } catch (err: any) {
      if (!mounted.current) return;
      telegramService.haptic('error');
      setSendError(err.message || 'Сообщение не ушло. Попробуй ещё раз');
      if (err.status === 403) void refresh(true);
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  const handleOpenProfile = (userId?: number) => {
    if (!userId) return;
    telegramService.haptic('light');
    openUser(userId);
  };

  const startReply = (m: MeetupChatMessage) => {
    telegramService.haptic('light');
    setReplyingTo(m);
    setActiveMessageId(null);
    window.setTimeout(() => textareaRef.current?.focus(), 40);
  };

  const title = kind === 'group' ? 'Чат сходки' : list ? 'Вопросы по сходке' : 'Переписка по сходке';
  const recentIds = new Set(thread?.messages.map((m) => m.id));
  const messages = thread ? [...older.filter((m) => !recentIds.has(m.id)), ...thread.messages] : [];
  const avatarOf = (userId?: number, direct?: string) => direct || (userId ? avatars?.[userId] : undefined);

  return <>
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={thread?.canSend ? (
        <form onSubmit={send}>
          {sendError && <p role="alert" className="mb-2 text-sm2 font-semibold text-zine-danger">{sendError}</p>}
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
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zine-inkMuted active:bg-zine-border cursor-pointer"
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
                placeholder={kind === 'question' && !messages.length ? 'Напиши свой вопрос…' : 'Напиши сообщение…'}
                aria-label="Сообщение"
                maxLength={600}
                rows={1}
                disabled={sending}
                className="field min-h-[46px] max-h-28 w-full rounded-2xl py-2.5 text-base leading-snug"
              />
              {text.length > 480 && (
                <span className="pointer-events-none absolute right-3 bottom-1.5 text-[11px] font-semibold text-zine-inkMuted">
                  {600 - text.length}
                </span>
              )}
            </div>
            <button
              type="submit"
              aria-label="Отправить сообщение"
              disabled={sending || !text.trim()}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-zine-terracotta text-white transition-transform active:scale-[0.95] disabled:opacity-40 cursor-pointer"
            >
              {sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
            </button>
          </div>
        </form>
      ) : undefined}
    >
      <div className="space-y-3 pt-1">
        {/* Компактная плашка с названием сходки и сроком жизни переписки */}
        {(data?.title || eventTitle || data?.expiresAt) && (
          <div className="rounded-zine-sm border border-zine-border/70 bg-zine-card/70 px-3.5 py-2.5">
            {(data?.title || eventTitle) && (
              <p className="break-words font-serif font-bold text-body text-zine-ink leading-snug">
                {data?.title || eventTitle}
              </p>
            )}
            {data?.expiresAt && (
              <p className="mt-1 flex items-center gap-1.5 text-cap text-zine-inkMuted">
                <Clock size={13} className="shrink-0" />
                <span>Переписка хранится 48 часов, до {closeTime(data.expiresAt)} по Минску</span>
              </p>
            )}
          </div>
        )}

        {/* Чат временно отключён на проверку после стоп-слова */}
        {data?.chatPaused && (
          <div role="status" className="flex items-start gap-2.5 rounded-zine-sm border border-zine-terracotta/40 bg-zine-terracotta/10 p-3.5">
            <ShieldAlert size={19} className="mt-0.5 shrink-0 text-zine-terracotta" />
            <p className="text-sm2 text-zine-ink leading-snug">
              Чат временно отключён на проверку модератором. Как только всё проверим, переписка снова откроется.
            </p>
          </div>
        )}

        {/* Состояние ошибки */}
        {error && (
          <div role="alert" className="rounded-zine bg-zine-card border border-zine-border p-4 text-center">
            <p className="text-body text-zine-ink">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 min-h-[44px] px-5 rounded-full bg-zine-terracotta/15 font-bold text-sm2 text-zine-terracotta active:scale-[0.98] transition-transform cursor-pointer"
            >
              Попробовать ещё раз
            </button>
          </div>
        )}

        {/* Скелетон загрузки */}
        {!data && !error && (
          <div aria-label="Загружаю переписку" className="space-y-3.5 py-3">
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

        {/* Список вопросов для организатора */}
        {list && (
          list.length ? (
            <div className="space-y-2">
              {list.map((row) => (
                <button
                  type="button"
                  key={row.askerId}
                  onClick={() => {
                    telegramService.haptic('light');
                    onChoose(row.askerId);
                  }}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-zine border border-zine-border/70 bg-zine-card px-3.5 py-2.5 text-left transition-transform active:scale-[0.98] cursor-pointer"
                >
                  <ChatAvatar
                    src={avatarOf(row.askerId, row.avatarUrl)}
                    name={row.name}
                    userId={row.askerId}
                    size="w-11 h-11 text-body"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-bold text-zine-ink">{row.name}</p>
                    <p className="text-cap text-zine-inkMuted">Открыть переписку</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-cap text-zine-inkMuted">
                    <span>{hhmm(row.updatedAt)}</span>
                    <ChevronRight size={18} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-zine bg-zine-card p-5 text-center">
              <div className="mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-full bg-zine-terracotta/10 text-zine-terracotta">
                <MessageCircle size={22} />
              </div>
              <p className="text-body font-semibold text-zine-ink">Вопросов пока нет</p>
              <p className="mt-1 text-sm2 text-zine-inkMuted">
                Когда кто-то напишет по сходке, переписка появится здесь.
              </p>
            </div>
          )
        )}

        {/* Открытая переписка (общий чат или личный вопрос) */}
        {thread && <>
          {(askerId !== undefined || thread.peerName) && (
            <div className="flex items-center gap-2.5 rounded-zine-sm bg-zine-card/60 px-2.5 py-2">
              {askerId !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    telegramService.haptic('light');
                    onChoose();
                  }}
                  aria-label="Все вопросы"
                  className="flex min-h-[44px] items-center gap-0.5 pr-1.5 font-bold text-sm2 text-zine-terracotta active:opacity-70 cursor-pointer"
                >
                  <ChevronLeft size={19} />
                  <span>Все вопросы</span>
                </button>
              )}
              {thread.peerName && (
                <button
                  type="button"
                  onClick={() => handleOpenProfile(thread.peerId ?? askerId)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-80 cursor-pointer"
                >
                  <ChatAvatar
                    src={avatarOf(thread.peerId ?? askerId, thread.peerAvatarUrl)}
                    name={thread.peerName}
                    userId={thread.peerId ?? askerId}
                    size="w-9 h-9 text-sm2"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm2 font-bold text-zine-ink">{thread.peerName}</span>
                    <span className="block text-cap text-zine-inkMuted">Личная переписка</span>
                  </span>
                </button>
              )}
            </div>
          )}

          {earlier && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadEarlier}
                disabled={loadingEarlier}
                className="min-h-[44px] rounded-full bg-zine-card px-4 text-sm2 font-bold text-zine-terracotta active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
              >
                {loadingEarlier ? 'Загружаю…' : 'Предыдущие сообщения'}
              </button>
            </div>
          )}

          {!messages.length && (
            <div className="rounded-zine bg-zine-card p-5 text-center">
              <div className="mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-full bg-zine-sage/15 text-zine-sage">
                <MessageCircle size={22} />
              </div>
              <p className="text-sm2 text-zine-ink leading-relaxed">
                {kind === 'group'
                  ? 'Здесь можно договориться, где встретиться, или предупредить, что опаздываешь.'
                  : thread.canSend
                    ? 'Уточни у организатора всё, что поможет решить, идти ли на сходку.'
                    : data?.chatPaused
                      ? 'Чат сейчас на проверке у модератора.'
                      : 'Сходка уже закончилась, поэтому новый вопрос задать нельзя.'}
              </p>
            </div>
          )}

          {messages.length > 0 && (
            <div className="space-y-1 pb-1">
              {!data?.chatPaused && (
                <p className="text-center text-[11px] text-zine-inkMuted">
                  Нажми на сообщение, чтобы ответить или поставить реакцию
                </p>
              )}
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
                    <div className={`${sameAsPrev ? 'mt-0.5' : 'mt-3'}`}>
                      <div className={`flex items-end gap-2 ${m.mine ? 'justify-end' : 'justify-start'}`}>
                        {!m.mine && (
                          sameAsNext ? (
                            <span className="w-8 shrink-0" aria-hidden />
                          ) : (
                            <ChatAvatar
                              src={avatarOf(m.senderId, m.avatarUrl)}
                              name={m.name}
                              userId={m.senderId}
                              size="w-8 h-8 text-cap"
                              onClick={() => handleOpenProfile(m.senderId)}
                            />
                          )
                        )}
                        <div className={`min-w-0 max-w-[82%] flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                          <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={isActive}
                            onClick={() => {
                              if (data?.chatPaused) return;
                              telegramService.haptic('light');
                              setActiveMessageId((curr) => (curr === m.id ? null : m.id));
                            }}
                            onKeyDown={(e) => {
                              if (!data?.chatPaused && (e.key === 'Enter' || e.key === ' ')) {
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
                            {!m.mine && !sameAsPrev && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenProfile(m.senderId);
                                }}
                                className="mb-0.5 block max-w-full truncate text-left text-cap font-bold text-zine-terracotta active:opacity-70 cursor-pointer"
                              >
                                {m.name}
                              </button>
                            )}
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
                                  disabled={Boolean(data?.chatPaused)}
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

                          {/* Панель быстрых действий по нажатию на сообщение */}
                          {isActive && !data?.chatPaused && (
                            <div className="mt-1.5 rounded-zine-sm border border-zine-border bg-zine-cardElevated p-2 shadow-sm">
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
                                {thread.canSend && (
                                  <button
                                    type="button"
                                    onClick={() => startReply(m)}
                                    className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-zine-card px-3 text-cap font-bold text-zine-ink active:scale-[0.98] transition-transform cursor-pointer"
                                  >
                                    <Reply size={15} className="text-zine-terracotta" />
                                    <span>Ответить</span>
                                  </button>
                                )}
                                {!m.mine && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMessageId(null);
                                      setReporting(m);
                                    }}
                                    className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-zine-card px-3 text-cap font-bold text-zine-inkMuted active:text-zine-danger cursor-pointer"
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
        </>}
      </div>
    </BottomSheet>
    {reporting && (
      <ReportSheet
        targetType="user"
        targetId={reporting.senderId}
        targetName={reporting.name}
        onClose={() => setReporting(null)}
        onReported={() => {
          setOlder((items) => items.filter((m) => m.senderId !== reporting.senderId));
          void refresh();
        }}
        submit={async (reason, comment) => {
          const excerpt = `Сообщение по сходке «${data?.title || eventTitle || ''}»: ${reporting.text}`;
          await api.report('user', reporting.senderId, reason, [comment, excerpt].filter(Boolean).join('\n').slice(0, 500));
        }}
        successText="Жалоба отправлена. Сообщения этого человека будут скрыты."
      />
    )}
  </>;
}
