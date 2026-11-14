import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AppEvent, HostInfo, MonthHost, UserProfile } from '../types';
import { EventsScreen } from '../screens/EventsScreen';
import { UserBottomSheet } from '../components/common/UserBottomSheet';
import { OpenUserContext } from '../context/openUser';
import { EVENT_EDIT } from '../context/eventUpdates';

/**
 * Только для разработки: ?preview=hosts — лента сходок на выдуманных данных: строчка об организаторе, значки 🔥 и 🍩,
 * карточка «Организаторы месяца» и «Повторить» у своей прошедшей сходки.
 * В сборку для людей не попадает (main.tsx подгружает файл только в dev)
 */

const ME = 999001; // тот же, что подставляет telegramService.getUser() при разработке
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const avatar = (letter: string, bg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/><text x="150" y="190" font-size="130" font-family="Georgia" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`
  )}`;

const people = {
  me: { telegramId: ME, name: 'Алексей', avatarUrl: avatar('А', '#B5462A') },
  masha: { telegramId: 2001, name: 'Маша', avatarUrl: avatar('М', '#5E8C6A') },
  dima: { telegramId: 2002, name: 'Дима', avatarUrl: avatar('Д', '#4A6FA5') },
  olya: { telegramId: 2003, name: 'Оля', avatarUrl: avatar('О', '#C77D86') },
  kate: { telegramId: 2004, name: 'Катя', avatarUrl: avatar('К', '#B8892B') }
};
const hostOf: Record<number, HostInfo> = {
  [ME]: { held: 4, active: true },
  2001: { held: 12, active: true, supporter: true },
  2002: { held: 5, supporter: true },
  2003: { held: 3, active: true },
  2004: { held: 1 }
};

const event = (id: string, title: string, creator: (typeof people)[keyof typeof people], inMs: number, extra: Partial<AppEvent> = {}): AppEvent => ({
  id,
  title,
  description: 'Собираемся у входа, берём кофе и идём гулять. Новичкам рады.',
  category: 'walk',
  locationName: 'Парк Горького, главный вход',
  coordinates: [53.9033, 27.5722],
  dateTime: new Date(Date.now() + inMs).toISOString(),
  creator,
  participants: [creator, people.olya, people.kate].filter((p, i, all) => all.findIndex((x) => x.telegramId === p.telegramId) === i),
  participantsCount: 3,
  maxParticipants: 8,
  isJoined: creator.telegramId === ME,
  durationMinutes: 120,
  host: hostOf[creator.telegramId],
  ...extra
});

const EVENTS: AppEvent[] = [
  event('e1', 'Прогулка по набережной и кофе', people.masha, 2 * DAY),
  event('e2', 'Настолки в антикафе', people.dima, 3 * DAY, { category: 'boardgames', locationName: 'Антикафе «Дом»' }),
  event('e3', 'Выставка в Нацхудожке', people.kate, 4 * DAY, { category: 'exhibition' }),
  event('e4', 'Субботний кофе у реки', people.me, -3 * HOUR, { category: 'cafe', locationName: 'Кофейня на Немиге' }),
  event('e5', 'Вечерний забег по парку', people.me, 5 * DAY, { category: 'sport' })
];

const MONTH: MonthHost[] = [
  ...[people.masha, people.dima, people.olya, people.kate].map((p, i) => ({ ...p, ...hostOf[p.telegramId], ...([9, 3, 1][i] ? { excellent: [9, 3, 1][i] } : {}) })),
  ...['Nick', 'Ира', 'Саша', 'Лена', 'Паша'].map((name, i) => ({ telegramId: 3000 + i, name, avatarUrl: avatar(name[0], '#7A6A5A'), held: 1 }))
];

const profile: UserProfile = {
  id: '2001',
  telegramId: 2001,
  firstName: 'Маша',
  avatarUrl: people.masha.avatarUrl,
  photos: [],
  bio: 'Каждую субботу собираю прогулку с кофе',
  goal: 'walk',
  goals: ['walk', 'boardgames'],
  age: 29,
  gender: 'female',
  preferredGender: 'all',
  preferredAgeRange: { min: 18, max: 99 },
  coordinates: [53.9, 27.56],
  areaName: 'Немига / Центр',
  isSupporter: true,
  hostActive: true,
  hostedCount: 12
} as UserProfile;

// Сервера нет: подменяем только то, что нужно этой ленте
Object.assign(api, {
  getMonthHosts: async () => MONTH,
  getPastMine: async () => [
    event('p1', 'Субботний кофе у реки', people.me, -3 * HOUR, { category: 'cafe' }),
    event('p2', 'Настолки для новичков', people.me, -9 * DAY, { category: 'boardgames' }),
    event('p3', 'Прогулка по Лошицкому парку', people.me, -23 * DAY)
  ],
  getWishes: async () => ({ summary: [], kindCounts: {}, mine: [], proposeAt: 3, stats: null }),
  getEventTemplates: async () => []
});

export const HostsPreview: React.FC = () => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [edit, setEdit] = useState<AppEvent | null>(null);
  // «Изменить» и «Повторить» из подробной карточки обычно ловит App
  useEffect(() => {
    const onEdit = (e: Event) => setEdit((e as CustomEvent<AppEvent>).detail);
    window.addEventListener(EVENT_EDIT, onEdit);
    return () => window.removeEventListener(EVENT_EDIT, onEdit);
  }, []);
  const noop = () => {};
  return (
    <OpenUserContext.Provider value={setOpenId}>
      <div className="h-[100dvh] flex flex-col bg-zine-paper">
        <EventsScreen events={EVENTS} currentUserId={ME} initialEdit={edit} onInitialEditUsed={() => setEdit(null)} onCreateEvent={async (p) => ({ ...EVENTS[0], ...p, id: 'new' })} />
      </div>
      {openId !== null && <UserBottomSheet user={profile} myGoals={['walk']} onClose={() => setOpenId(null)} onReact={noop} onReported={noop} onGoTogether={noop} onHello={noop} onDuel={noop} />}
    </OpenUserContext.Provider>
  );
};
