import React, { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { HELLO_TEXTS as H, DUEL_TEXTS as D, WAVE_GATE_TEXTS as W } from '../../texts/hello';
import { CoinFlip } from './CoinFlip';

// Как падала монетка, показываем один раз на человека, дальше — сразу итог
const COIN_SEEN = 'yesminsk_coin_seen';
export const coinSeen = (id: number) => {
  try {
    return (JSON.parse(localStorage.getItem(COIN_SEEN) || '[]') as number[]).includes(id);
  } catch {
    return false;
  }
};
export const markCoinSeen = (id: number) => {
  try {
    const list = JSON.parse(localStorage.getItem(COIN_SEEN) || '[]') as number[];
    if (!list.includes(id)) localStorage.setItem(COIN_SEEN, JSON.stringify([...list, id].slice(-200)));
  } catch {}
};

/**
 * Шторки вокруг «На связи»:
 *  • HelloSheet — «✍️ Что написать»: три готовые фразы, тап открывает чат с набранным текстом;
 *  • DuelSheet — «🎲 Сыграть»: выбор игры, бот передаёт приглашение;
 *  • UsernameSheet — перед первым 👋, если нет @username: ответить будет некуда
 */

export const HelloSheet: React.FC<{ friendId: number; name: string; myAvatarUrl?: string; onClose: () => void }> = ({ friendId, name, myAvatarUrl, onClose }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getHello>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animateCoin] = useState(() => !coinSeen(friendId));

  useEffect(() => {
    api
      .getHello(friendId)
      .then((d) => {
        setData(d);
        if (d.firstMove) markCoinSeen(friendId);
      })
      .catch((e) => setError(e?.message || H.failed));
  }, [friendId]);

  // Сначала отмечаем выбор (keepalive дойдёт, даже если Telegram свернёт приложение), потом открываем чат
  const send = (text?: string) => {
    if (!data) return;
    telegramService.haptic('medium');
    if (text) api.pickHello(friendId);
    telegramService.openChat(data.friend.username, text);
    onClose();
  };

  const who = data?.friend.firstName || name;
  return (
    <BottomSheet title={H.title} onClose={onClose}>
      {data?.firstMove && (
        <div className="mb-4">
          <CoinFlip
            result={data.firstMove}
            me={{ avatarUrl: myAvatarUrl, label: H.you }}
            them={{ avatarUrl: data.friend.avatarUrl, label: who }}
            text={data.firstMove === 'me' ? H.coinMe : H.coinThem(who)}
            animate={animateCoin}
            size={animateCoin ? 104 : 76}
          />
        </div>
      )}
      <p className="text-sm2 text-zine-inkMuted">{H.hint}</p>
      {error && <p className="mt-4 text-body text-zine-danger">{error}</p>}
      {!data && !error && (
        <div className="py-10 flex justify-center text-zine-inkMuted">
          <Loader2 size={26} className="animate-spin" />
        </div>
      )}
      {data && (
        <div className="mt-4 space-y-2">
          {data.phrases.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="w-full min-h-[56px] px-4 py-3 rounded-zine-sm bg-zine-cardElevated border border-zine-border text-left text-body text-zine-ink flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <span className="flex-1">{p}</span>
              <Send size={18} className="shrink-0 text-zine-terracotta" />
            </button>
          ))}
          <button onClick={() => send()} className="w-full h-11 text-sm2 font-semibold text-zine-inkMuted cursor-pointer">
            {H.own}
          </button>
        </div>
      )}
    </BottomSheet>
  );
};

export type DuelStarted = { game: 'five' | 'sea'; id: string };

export const DuelSheet: React.FC<{ friendId: number; name: string; onClose: () => void; onStarted: (g: DuelStarted) => void }> = ({ friendId, name, onClose, onStarted }) => {
  const [busy, setBusy] = useState<'five' | 'sea' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (game: 'five' | 'sea') => {
    if (busy) return;
    telegramService.haptic('medium');
    setBusy(game);
    setError(null);
    try {
      const g = game === 'sea' ? await api.seaInvite(false, friendId) : await api.gameInvite(false, friendId);
      telegramService.haptic('success');
      if (g.delivered === false) telegramService.alert(D.notDelivered);
      onStarted({ game, id: g.id });
    } catch (e: any) {
      setError(e?.message || 'Не получилось позвать');
    } finally {
      setBusy(null);
    }
  };

  const Option: React.FC<{ id: 'five' | 'sea'; title: string; hint: string }> = ({ id, title, hint }) => (
    <button
      onClick={() => start(id)}
      disabled={Boolean(busy)}
      className="w-full min-h-[64px] px-4 py-3 rounded-zine-sm bg-zine-cardElevated border-2 border-zine-border text-left flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform disabled:opacity-70"
    >
      <span className="flex-1">
        <span className="block text-lead font-bold text-zine-ink">{title}</span>
        <span className="block text-sm2 text-zine-inkMuted">{hint}</span>
      </span>
      {busy === id && <Loader2 size={22} className="animate-spin text-zine-terracotta" />}
    </button>
  );

  return (
    <BottomSheet title={D.title} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{D.hint(name)}</p>
      <div className="mt-4 space-y-2">
        <Option id="five" title={D.five} hint={D.fiveHint} />
        <Option id="sea" title={D.sea} hint={D.seaHint} />
      </div>
      {error && <p className="mt-3 text-sm2 font-semibold text-zine-danger">{error}</p>}
    </BottomSheet>
  );
};

export const UsernameSheet: React.FC<{ onDone: (username: string) => void; onLater: () => void }> = ({ onDone, onLater }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api.waveGateEvent('username_shown');
  }, []);

  const check = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { username } = await api.checkUsername();
      if (username) {
        telegramService.haptic('success');
        api.waveGateEvent('username_done');
        onDone(username);
      } else {
        telegramService.haptic('warning');
        setNote(W.notYet);
      }
    } catch (e: any) {
      setNote(e?.message || W.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={W.usernameTitle} onClose={onLater}>
      <p className="text-body text-zine-inkMuted">{W.usernameText}</p>
      <ol className="mt-4 space-y-2">
        {W.usernameSteps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-body text-zine-ink">
            <span className="w-7 h-7 shrink-0 rounded-full bg-zine-mustard/25 text-zine-ink text-sm2 font-bold flex items-center justify-center">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm2 text-zine-inkMuted">{W.usernameTime}</p>
      {note && <p className="mt-3 text-sm2 font-semibold text-zine-danger">{note}</p>}
      <button
        onClick={check}
        disabled={busy}
        className="mt-5 w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform"
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : W.check}
      </button>
      <button onClick={onLater} className="mt-2 w-full h-11 text-sm2 font-semibold text-zine-inkMuted cursor-pointer">
        {W.later}
      </button>
    </BottomSheet>
  );
};
