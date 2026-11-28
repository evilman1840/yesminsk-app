import React, { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { EventsScreen } from '../screens/EventsScreen';
import { AppEvent } from '../types';
import { api } from '../services/api';
import { EVENT_UPDATED } from '../context/eventUpdates';

// Только локальное превью: сеть отключена, все сходки выдуманные.
window.fetch = async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
const sample: AppEvent = { id: 'preview-like', title: 'Кофе, настолки и новые знакомые ☕', description: 'Встречаемся за большим столом, знакомимся и играем.', category: 'boardgames', locationName: 'Уютное кафе на Немиге', coordinates: [53.9, 27.5], dateTime: new Date(Date.now() + 86400000).toISOString(), creator: { telegramId: 123, name: 'Саша', avatarUrl: '' }, participantsCount: 3, maxParticipants: 8, isJoined: false, likesCount: 12, isLiked: false };
let stored = { ...sample };
let fail = false;
Object.assign(api, {
  getMonthHosts: async () => [], getPastMine: async () => [], getEventTemplates: async () => [],
  getWishes: async () => ({ mine: [], summary: [], kindCounts: {}, totalActive: 128, maxActive: 5 }),
  getLikedEvents: async () => { if (fail) throw new Error('preview'); return stored.isLiked ? [{ ...stored }] : []; },
  setEventLike: async (_id: string, liked: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 350));
    if (fail) throw new Error('preview');
    stored = { ...stored, isLiked: liked, likesCount: liked ? 13 : 12 };
    return { isLiked: stored.isLiked, likesCount: stored.likesCount };
  }
});
export function EventLikesPreview() {
  const [event, setEvent] = useState(sample);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(390);
  useEffect(() => {
    const update = (message: Event) => setEvent(e => ({ ...e, ...(message as CustomEvent<Partial<AppEvent>>).detail }));
    window.addEventListener(EVENT_UPDATED, update);
    return () => window.removeEventListener(EVENT_UPDATED, update);
  }, []);
  return <main className="bg-zine-paper text-zine-ink min-h-screen">
    <div className="flex flex-wrap gap-2 p-2">
      <button className="min-h-11 px-3 bg-zine-card" onClick={() => document.documentElement.classList.toggle('dark')}>Сменить тему</button>
      <button className="min-h-11 px-3 bg-zine-card" onClick={() => { fail = !error; setError(!error); }}>Сеть: {error ? 'ошибка' : 'работает'}</button>
      <select aria-label="Ширина" value={width} onChange={e => setWidth(Number(e.target.value))}>{[360, 375, 390, 430].map(w => <option key={w}>{w}</option>)}</select>
    </div>
    <div style={{ width, maxWidth: '100%', height: 740 }} className="mx-auto border border-zine-border"><EventsScreen events={[event]} currentUserId={456} /></div>
    <Toaster />
  </main>;
}
