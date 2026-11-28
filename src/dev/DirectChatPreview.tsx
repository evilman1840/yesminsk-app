import React, { useState } from 'react';
import { api } from '../services/api';
import type { DirectChatData, DirectChatMessage } from '../types';
import { DirectChatSheet } from '../components/common/DirectChatSheet';
import { OpenUserContext } from '../context/openUser';

/**
 * Только для разработки: ?preview=direct-chat - проверка личного чата 1 на 1
 * (скелетоны загрузки, пустой чат с монеткой и 3 фразами, живая переписка с ответами и реакциями, ошибка).
 * В сборку для людей не попадает (main.tsx подгружает файл только в dev).
 */

const ME = 999001;
const PEER_EMPTY = 3001;
const PEER_ACTIVE = 3002;
const PEER_LOADING = 3003;
const PEER_ERROR = 3004;

const avatar = (letter: string, bg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/><text x="150" y="190" font-size="130" font-family="Georgia" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`
  )}`;

const meAvatar = avatar('А', '#B5462A');
const peerAvatars: Record<number, { name: string; age: number; avatarUrl: string }> = {
  [PEER_EMPTY]: { name: 'Аня', age: 27, avatarUrl: avatar('А', '#5E8C6A') },
  [PEER_ACTIVE]: { name: 'Дима', age: 30, avatarUrl: avatar('Д', '#B8892B') },
  [PEER_LOADING]: { name: 'Катя', age: 26, avatarUrl: avatar('К', '#C77D86') },
  [PEER_ERROR]: { name: 'Оля', age: 28, avatarUrl: avatar('О', '#6B7E9A') }
};

const nowIso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

const store: Record<number, DirectChatMessage[]> = {
  [PEER_EMPTY]: [],
  [PEER_ACTIVE]: [
    {
      id: 'd1',
      mine: false,
      senderId: PEER_ACTIVE,
      name: 'Дима',
      avatarUrl: peerAvatars[PEER_ACTIVE].avatarUrl,
      text: 'Привет! Монетка выбрала меня, так что пишу первым 🙂 Ты тоже любишь прогулки по набережной?',
      createdAt: nowIso(1440),
      reactions: [{ emoji: '👍', count: 1, mine: true }]
    },
    {
      id: 'd2',
      mine: true,
      senderId: ME,
      name: 'Ты',
      avatarUrl: meAvatar,
      text: 'Привет! Да, особенно вечером от Немиги в сторону парка Горького. Можно заодно зайти за кофе.',
      replyTo: { id: 'd1', senderName: 'Дима', text: 'Привет! Монетка выбрала меня, так что пишу первым 🙂 Ты тоже любишь прогулки по набережной?' },
      createdAt: nowIso(45),
      reactions: [{ emoji: '❤️', count: 1, mine: false }]
    },
    {
      id: 'd3',
      mine: false,
      senderId: PEER_ACTIVE,
      name: 'Дима',
      avatarUrl: peerAvatars[PEER_ACTIVE].avatarUrl,
      text: 'Супер! Давай выберем какую-нибудь сходку на выходных или просто пройдёмся компанией в субботу днём?',
      createdAt: nowIso(12)
    }
  ]
};

const samplePhrases = [
  'Привет! Мы оба из района «Немига». Где тут нормальный кофе?',
  'Привет! Скажи честно: кофе, прогулка или настолки?',
  'Привет! Может, сходим на какую-нибудь сходку вместе? Вдвоём заходить проще'
];

let seq = 10;

Object.assign(api, {
  getDirectChat: async (peerId: number): Promise<DirectChatData> => {
    if (peerId === PEER_LOADING) {
      return new Promise<DirectChatData>(() => {});
    }
    if (peerId === PEER_ERROR) {
      const err: any = new Error('Не получилось загрузить чат. Проверь соединение и попробуй ещё раз');
      err.status = 500;
      throw err;
    }
    const peer = peerAvatars[peerId] || peerAvatars[PEER_ACTIVE];
    const list = store[peerId] || [];
    return {
      peer: {
        telegramId: peerId,
        firstName: peer.name,
        age: peer.age,
        avatarUrl: peer.avatarUrl
      },
      firstMove: peerId === PEER_EMPTY ? 'me' : 'them',
      firstMoveAt: nowIso(10),
      phrases: list.length === 0 ? samplePhrases : [],
      messages: [...list],
      before: null,
      canSend: true,
      expiresInDays: 7,
      canPlay: true,
      comfort:
        peerId === PEER_ACTIVE
          ? { mutualSerious: false, mutualCasual: true, myCasualPace: 'coffee_first', peerCasualPace: 'chat_first' }
          : peerId === PEER_EMPTY
            ? { mutualSerious: true, mutualCasual: false }
            : undefined
    };
  },
  sendDirectChatMessage: async (peerId: number, text: string, _clientId: string, replyToId?: string) => {
    if (!store[peerId]) store[peerId] = [];
    const target = replyToId ? store[peerId].find((m) => m.id === replyToId) : undefined;
    const msg: DirectChatMessage = {
      id: `dm-${++seq}`,
      mine: true,
      senderId: ME,
      name: 'Ты',
      avatarUrl: meAvatar,
      text,
      ...(target ? { replyTo: { id: target.id, senderName: target.mine ? 'Ты' : target.name, text: target.text } } : {}),
      reactions: [],
      createdAt: new Date().toISOString()
    };
    store[peerId].push(msg);
    return { message: msg };
  },
  toggleDirectChatReaction: async (peerId: number, messageId: string, emoji: string) => {
    const msg = (store[peerId] || []).find((m) => m.id === messageId);
    if (!msg) return { reactions: [] };
    const next = (msg.reactions || []).map((r) => ({ ...r }));
    const existing = next.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.mine) {
        existing.mine = false;
        existing.count = Math.max(0, existing.count - 1);
      } else {
        existing.mine = true;
        existing.count += 1;
      }
    } else {
      next.push({ emoji, count: 1, mine: true });
    }
    msg.reactions = next.filter((r) => r.count > 0);
    return { reactions: msg.reactions };
  },
  reportDirectChat: async () => ({ success: true }),
  reactToUser: async () => ({ success: true, isMatch: false })
});

type Mode = 'empty' | 'active' | 'loading' | 'error';

const MODES: { id: Mode; label: string; peerId: number }[] = [
  { id: 'empty', label: 'Пустой + фразы', peerId: PEER_EMPTY },
  { id: 'active', label: 'Переписка', peerId: PEER_ACTIVE },
  { id: 'loading', label: 'Загрузка', peerId: PEER_LOADING },
  { id: 'error', label: 'Ошибка', peerId: PEER_ERROR }
];

export const DirectChatPreview: React.FC = () => {
  const [mode, setMode] = useState<Mode>('empty');
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState('');

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const current = MODES.find((m) => m.id === mode) || MODES[0];
  const peer = peerAvatars[current.peerId];

  return (
    <OpenUserContext.Provider value={(id) => setNotice(`Открыта анкета пользователя #${id}`)}>
      <div className="min-h-[100dvh] bg-zine-paper text-zine-ink">
        <div className="sticky top-0 z-20 border-b border-zine-border bg-zine-cardElevated px-4 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-serif text-sm2 font-bold text-zine-ink">Превью личного чата</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[36px] rounded-full bg-zine-card px-3 text-cap font-bold text-zine-ink cursor-pointer"
            >
              {dark ? 'Светлая' : 'Тёмная'}
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setOpen(true);
                  setNotice('');
                }}
                className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm2 font-bold transition-colors cursor-pointer ${
                  mode === m.id ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-[400px] px-4 py-6">
          <div className="rounded-zine border border-zine-border bg-zine-card p-5 text-center">
            <p className="font-serif text-title font-bold text-zine-ink">Личный чат 1 на 1</p>
            <p className="mt-1.5 text-sm2 text-zine-inkMuted">
              Переключай режимы сверху, чтобы проверить все состояния экрана.
            </p>
            {notice && <p className="mt-3 rounded-zine-sm bg-zine-sage/15 px-3 py-2 text-sm2 font-semibold text-zine-ink">{notice}</p>}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 min-h-[48px] w-full rounded-full bg-zine-terracotta px-5 text-body font-bold text-white active:scale-[0.98] transition-transform cursor-pointer"
            >
              💬 Открыть чат ({peer.name})
            </button>
          </div>
        </div>

        {open && (
          <DirectChatSheet
            key={`${mode}:${current.peerId}`}
            peerId={current.peerId}
            peerName={peer.name}
            peerAvatarUrl={peer.avatarUrl}
            myAvatarUrl={meAvatar}
            onClose={() => setOpen(false)}
            onGoTogether={(id) => setNotice(`Открыта шторка «На сходку» с #${id}`)}
            onDuel={(id, name) => setNotice(`Открыта шторка «Сыграть» с ${name} (#${id})`)}
            onBlockedOrReported={(id) => {
              setNotice(`Собеседник #${id} скрыт / жалоба отправлена`);
              setOpen(false);
            }}
          />
        )}
      </div>
    </OpenUserContext.Provider>
  );
};
