import React, { useState } from 'react';
import { api } from '../services/api';
import type { AppEvent, MeetupChatData, MeetupChatKind, MeetupChatMessage } from '../types';
import { EventDetails } from '../components/common/EventDetails';
import { OpenUserContext } from '../context/openUser';

/**
 * Только для разработки: ?preview=meetup-chat — проверка чатов сходки на тестовых данных
 * (до записи, заявка ждёт одобрения, записанный участник, организатор).
 * В сборку для людей не попадает (main.tsx подгружает файл только в dev).
 */

const ME = 999001;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const avatar = (letter: string, bg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/><text x="150" y="190" font-size="130" font-family="Georgia" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`
  )}`;

const people = {
  me: { telegramId: ME, name: 'Алексей', avatarUrl: avatar('А', '#B5462A') },
  masha: { telegramId: 2001, name: 'Маша', avatarUrl: avatar('М', '#5E8C6A') },
  olya: { telegramId: 2003, name: 'Оля', avatarUrl: avatar('О', '#C77D86') },
  kate: { telegramId: 2004, name: 'Катя', avatarUrl: avatar('К', '#B8892B') }
};

const expiresAt = new Date(Date.now() + 4 * DAY).toISOString();

type Mode = 'guest' | 'pending' | 'joined' | 'host';

const makeEvent = (mode: Mode): AppEvent => {
  const isHost = mode === 'host';
  const creator = isHost ? people.me : people.masha;
  return {
    id: isHost ? 'e-host' : mode === 'pending' ? 'e-pending' : mode === 'joined' ? 'e-joined' : 'e-guest',
    title: isHost ? 'Настолки в антикафе «Дом»' : 'Прогулка по набережной и кофе',
    description: 'Встречаемся у главного входа, берём кофе и гуляем неспешным темпом. Новичкам рады, можно прийти одному.',
    category: isHost ? 'boardgames' : 'walk',
    locationName: isHost ? 'Антикафе «Дом», Немига' : 'Парк Горького, главный вход',
    coordinates: [53.9033, 27.5722],
    dateTime: new Date(Date.now() + 2 * DAY).toISOString(),
    durationMinutes: 120,
    chatExpiresAt: expiresAt,
    creator,
    participants: isHost
      ? [people.me, people.olya, people.kate]
      : mode === 'joined'
        ? [people.masha, people.olya, people.me]
        : mode === 'pending'
          ? [people.masha, people.olya, { ...people.me, pending: true }]
          : [people.masha, people.olya],
    participantsCount: mode === 'guest' ? 2 : 3,
    maxParticipants: 8,
    isJoined: mode === 'joined' || mode === 'pending' || isHost,
    byRequest: mode === 'pending',
    myPending: mode === 'pending',
    myApproved: mode === 'joined',
    host: { held: isHost ? 4 : 12, active: true, supporter: !isHost }
  };
};

const nowIso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

const store: Record<string, MeetupChatMessage[]> = {
  'e-guest:question': [
    { id: 'q1', mine: false, senderId: 2001, name: 'Маша', avatarUrl: people.masha.avatarUrl, text: 'Привет! Если есть вопросы по маршруту или времени, пиши здесь.', createdAt: nowIso(35), reactions: [{ emoji: '👍', count: 1, mine: false }] }
  ],
  'e-pending:question': [
    { id: 'qp1', mine: true, senderId: ME, name: 'Ты', avatarUrl: people.me.avatarUrl, text: 'Привет! Я подал заявку, успею к 19:15, ничего страшного?', createdAt: nowIso(20) },
    { id: 'qp2', mine: false, senderId: 2001, name: 'Маша', avatarUrl: people.masha.avatarUrl, text: 'Конечно, мы первые 15 минут собираемся у входа.', replyTo: { id: 'qp1', senderName: 'Ты', text: 'Привет! Я подал заявку, успею к 19:15, ничего страшного?' }, createdAt: nowIso(12) }
  ],
  'e-joined:group': [
    { id: 'g0', mine: false, senderId: 2001, name: 'Маша', avatarUrl: people.masha.avatarUrl, text: 'Всем привет! Буду в бежевом пальто прямо у арки парка.', createdAt: nowIso(1500), reactions: [{ emoji: '❤️', count: 2, mine: true }] },
    { id: 'g1', mine: false, senderId: 2001, name: 'Маша', avatarUrl: people.masha.avatarUrl, text: 'Если дождь, зайдём в кофейню справа от входа.', createdAt: nowIso(50), reactions: [{ emoji: '👍', count: 1, mine: false }] },
    { id: 'g2', mine: false, senderId: 2003, name: 'Оля', avatarUrl: people.olya.avatarUrl, text: 'Супер, я приду минут за 5 до старта.', replyTo: { id: 'g1', senderName: 'Маша', text: 'Если дождь, зайдём в кофейню справа от входа.' }, createdAt: nowIso(25) },
    { id: 'g3', mine: false, senderId: 2003, name: 'Оля', avatarUrl: people.olya.avatarUrl, text: 'Возьму ещё термос с чаем на всякий случай ☕', createdAt: nowIso(24), reactions: [{ emoji: '🔥', count: 1, mine: false }] }
  ],
  'e-host:group': [
    { id: 'hg1', mine: true, senderId: ME, name: 'Ты', avatarUrl: people.me.avatarUrl, text: 'Забронировал большой стол на втором этаже на имя Алексей.', createdAt: nowIso(40), reactions: [{ emoji: '🙏', count: 2, mine: false }] },
    { id: 'hg2', mine: false, senderId: 2003, name: 'Оля', avatarUrl: people.olya.avatarUrl, text: 'Ура, спасибо! Принесу Каркассон.', createdAt: nowIso(18) }
  ],
  'e-host:question:2003': [
    { id: 'hq1', mine: false, senderId: 2003, name: 'Оля', avatarUrl: people.olya.avatarUrl, text: 'Привет! Можно прийти, если я раньше не играла в настолки?', createdAt: nowIso(45) }
  ],
  'e-host:question:2004': [
    { id: 'hq2', mine: false, senderId: 2004, name: 'Катя', avatarUrl: people.kate.avatarUrl, text: 'Подскажи, пожалуйста, во сколько примерно закончим?', createdAt: nowIso(90) },
    { id: 'hq3', mine: true, senderId: ME, name: 'Ты', avatarUrl: people.me.avatarUrl, text: 'Обычно около 21:30, но можно уйти раньше в любой момент.', createdAt: nowIso(82) }
  ]
};

const pausedEvents = new Set<string>();
const peerInfo: Record<number, { name: string; avatarUrl: string }> = {
  2001: { name: 'Маша', avatarUrl: people.masha.avatarUrl },
  2003: { name: 'Оля', avatarUrl: people.olya.avatarUrl },
  2004: { name: 'Катя', avatarUrl: people.kate.avatarUrl }
};
let seq = 100;

Object.assign(api, {
  getMeetupChat: async (eventId: string, kind: MeetupChatKind, askerId?: number): Promise<MeetupChatData> => {
    const title = eventId === 'e-host' ? 'Настолки в антикафе «Дом»' : 'Прогулка по набережной и кофе';
    const chatPaused = pausedEvents.has(eventId);
    if (eventId === 'e-host' && kind === 'question' && askerId === undefined) {
      return {
        title,
        expiresAt,
        chatPaused,
        threads: [
          { askerId: 2003, name: 'Оля', avatarUrl: people.olya.avatarUrl, updatedAt: store['e-host:question:2003'][store['e-host:question:2003'].length - 1]?.createdAt || nowIso(45) },
          { askerId: 2004, name: 'Катя', avatarUrl: people.kate.avatarUrl, updatedAt: store['e-host:question:2004'][store['e-host:question:2004'].length - 1]?.createdAt || nowIso(82) }
        ]
      };
    }
    const key = eventId === 'e-host' && kind === 'question' ? `${eventId}:question:${askerId}` : `${eventId}:${kind}`;
    const peerId = kind === 'question' ? (askerId ?? 2001) : undefined;
    const peer = peerId ? peerInfo[peerId] : undefined;
    return {
      title,
      expiresAt,
      chatPaused,
      messages: [...(store[key] || [])],
      canSend: !chatPaused,
      peerName: peer?.name,
      peerAvatarUrl: peer?.avatarUrl,
      peerId,
      before: null
    };
  },
  sendMeetupChatMessage: async (eventId: string, kind: MeetupChatKind, text: string, _clientId: string, askerId?: number, replyToId?: string): Promise<void> => {
    if (/митинг|протест|политик/i.test(text)) {
      pausedEvents.add(eventId);
      const err: any = new Error('Сообщение не отправлено: чат временно отключён на проверку модератором.');
      err.status = 403;
      throw err;
    }
    const key = eventId === 'e-host' && kind === 'question' ? `${eventId}:question:${askerId}` : `${eventId}:${kind}`;
    if (!store[key]) store[key] = [];
    const target = replyToId ? store[key].find((m) => m.id === replyToId) : undefined;
    store[key].push({
      id: `m-${++seq}`,
      mine: true,
      senderId: ME,
      name: 'Ты',
      avatarUrl: people.me.avatarUrl,
      text,
      ...(target ? { replyTo: { id: target.id, senderName: target.mine ? 'Ты' : target.name, text: target.text } } : {}),
      reactions: [],
      createdAt: new Date().toISOString()
    });
  },
  toggleMeetupChatReaction: async (eventId: string, messageId: string, kind: MeetupChatKind, emoji: string, askerId?: number) => {
    const key = eventId === 'e-host' && kind === 'question' ? `${eventId}:question:${askerId}` : `${eventId}:${kind}`;
    const msg = (store[key] || []).find((m) => m.id === messageId);
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
  }
});

const MODES: { id: Mode; label: string }[] = [
  { id: 'guest', label: 'До записи' },
  { id: 'pending', label: 'Заявка' },
  { id: 'joined', label: 'Записан' },
  { id: 'host', label: 'Организатор' }
];

export const MeetupChatPreview: React.FC = () => {
  const [mode, setMode] = useState<Mode>('guest');
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const event = makeEvent(mode);

  return (
    <OpenUserContext.Provider value={() => {}}>
      <div className="min-h-[100dvh] bg-zine-paper text-zine-ink">
        <div className="sticky top-0 z-20 border-b border-zine-border bg-zine-cardElevated px-4 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-serif font-bold text-sm2 text-zine-ink">Превью чатов сходки</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[36px] px-3 rounded-full bg-zine-card text-cap font-bold text-zine-ink"
            >
              {dark ? 'Светлая' : 'Тёмная'}
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm2 font-bold transition-colors ${
                  mode === m.id ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-[420px] px-5 pt-4 pb-4 bg-zine-cardElevated min-h-[calc(100dvh-96px)]">
          <h3 className="font-serif font-bold text-title text-zine-ink mb-3">{event.title}</h3>
          <EventDetails event={event} onJoin={async () => {}} />
        </div>
      </div>
    </OpenUserContext.Provider>
  );
};
