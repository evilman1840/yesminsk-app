import React, { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { EventsScreen } from '../screens/EventsScreen';
import { AppEvent, JoinOptions } from '../types';
import { api } from '../services/api';
import { EVENT_UPDATED } from '../context/eventUpdates';

// Локальное превью карточек находок из Threads без обращений к реальному серверу
window.fetch = async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });

const initialEvents: AppEvent[] = [
  {
    id: 'threads-preview-1',
    external: {
      platform: 'threads',
      url: 'https://www.threads.com/@technosreda/post/DgSer3fCOYo',
      authorName: '«ТехноСреда» Комьюнити',
      authorHandle: 'technosreda',
      priceNote: 'Условия в посте',
      claimed: false,
      myClaimPending: false
    },
    title: 'Вечер тишины и Digital Detox под камином',
    description:
      'В эту среду откладываем телефоны в сторону, читаем книги под спокойную музыку, а в конце тепло общаемся в узком кругу у камина.',
    category: 'relax',
    badges: [],
    locationName: 'Хостел Урбан, ул. Заборского 3',
    coordinates: [53.912, 27.558],
    dateTime: new Date(Date.now() + 3 * 86400000).toISOString(),
    creator: { telegramId: 0, name: '@technosreda', avatarUrl: '' },
    participants: [],
    participantsCount: 0,
    maxParticipants: 0,
    isJoined: false,
    likesCount: 4,
    isLiked: false
  },
  {
    id: 'threads-preview-2',
    external: {
      platform: 'threads',
      url: 'https://www.threads.com/@nakrayuzemli34/post/DgSAvZbkc2v',
      authorName: 'Кофейня На краю земли',
      authorHandle: 'nakrayuzemli34',
      claimed: false,
      myClaimPending: false
    },
    title: 'Вечер живых знакомств за настольной игрой',
    description:
      'Тёплый вечер в кофейне на Грушевке: ведущие проводят авторскую настольную игру, которая помогает легко познакомиться без неловких пауз.',
    category: 'boardgames',
    badges: [],
    isPaid: true,
    payTo: 'host',
    price: 25,
    payFor: 'игра и ведущие',
    locationName: 'Кофейня «На краю земли», Грушевка',
    coordinates: [53.887, 27.518],
    dateTime: new Date(Date.now() + 5 * 86400000).toISOString(),
    creator: { telegramId: 0, name: '@nakrayuzemli34', avatarUrl: '' },
    participants: [
      { telegramId: 101, name: 'Катя', avatarUrl: '' },
      { telegramId: 102, name: 'Дима', avatarUrl: '' }
    ],
    participantsCount: 2,
    maxParticipants: 0,
    isJoined: false,
    likesCount: 7,
    isLiked: true
  }
];

Object.assign(api, {
  getMonthHosts: async () => [],
  getPastMine: async () => [],
  getEventTemplates: async () => [],
  getWishes: async () => ({ mine: [], summary: [], kindCounts: {}, totalActive: 96, maxActive: 5 }),
  getLikedEvents: async () => initialEvents.filter((e) => e.isLiked),
  setEventLike: async (_id: string, liked: boolean) => ({ isLiked: liked, likesCount: liked ? 5 : 4 }),
  claimExternalEvent: async (eventId: string, handle?: string) => {
    await new Promise((r) => setTimeout(r, 250));
    const target = initialEvents.find((e) => e.id === eventId) || initialEvents[0];
    return {
      ok: true,
      event: {
        ...target,
        external: { ...target.external!, authorHandle: handle || target.external?.authorHandle, myClaimPending: true }
      }
    };
  }
});

export function ThreadsEventPreview() {
  const [events, setEvents] = useState<AppEvent[]>(initialEvents);
  const [width, setWidth] = useState(375);

  useEffect(() => {
    const update = (message: Event) => {
      const next = (message as CustomEvent<Partial<AppEvent> & { id: string }>).detail;
      setEvents((prev) => prev.map((e) => (e.id === next.id ? { ...e, ...next } : e)));
    };
    window.addEventListener(EVENT_UPDATED, update);
    return () => window.removeEventListener(EVENT_UPDATED, update);
  }, []);

  const handleJoin = async (ev: AppEvent, options: JoinOptions | null): Promise<AppEvent | null> => {
    const updated: AppEvent = options
      ? {
          ...ev,
          isJoined: true,
          myGuests: options.guests,
          myWithKids: options.withKids,
          participantsCount: (ev.participantsCount || 0) + 1 + options.guests,
          participants: [...(ev.participants || []), { telegramId: 999001, name: 'Алексей', avatarUrl: '', guests: options.guests, withKids: options.withKids }]
        }
      : {
          ...ev,
          isJoined: false,
          myGuests: 0,
          myWithKids: false,
          participantsCount: Math.max(0, (ev.participantsCount || 1) - 1),
          participants: (ev.participants || []).filter((p) => p.telegramId !== 999001)
        };
    setEvents((prev) => prev.map((item) => (item.id === ev.id ? updated : item)));
    return updated;
  };

  return (
    <main className="bg-zine-paper text-zine-ink min-h-screen">
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-zine-border">
        <button
          type="button"
          className="min-h-11 px-3 rounded-zine-sm bg-zine-card text-sm2 font-semibold cursor-pointer"
          onClick={() => document.documentElement.classList.toggle('dark')}
        >
          Светлая / тёмная
        </button>
        <select
          aria-label="Ширина экрана"
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="min-h-11 px-3 rounded-zine-sm bg-zine-card text-sm2 font-semibold"
        >
          {[360, 375, 390, 430].map((w) => (
            <option key={w} value={w}>
              {w} px
            </option>
          ))}
        </select>
      </div>
      <div style={{ width, maxWidth: '100%', height: 760 }} className="mx-auto border border-zine-border overflow-hidden">
        <EventsScreen events={events} currentUserId={999001} onJoin={handleJoin} />
      </div>
      <Toaster />
    </main>
  );
}
