import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { PersonReel } from '../screens/FeedScreen';
import { UserBottomSheet } from '../components/common/UserBottomSheet';
import { UserProfile } from '../types';
import { api } from '../services/api';

// Изолированное превью: все запросы перехвачены, рабочие данные не читаем и не меняем.
window.fetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
Object.assign(api, { markPeopleSeen: async () => {}, getMonthHosts: async () => [] });
const noop = () => {};
function Preview() {
  const [width, setWidth] = useState(360);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('both');
  const [count, setCount] = useState(8);
  const [longName, setLongName] = useState(false);
  const user: UserProfile = {
    id: 'preview', telegramId: -123, firstName: longName ? 'Александра-Екатерина' : 'Саша', age: 29, gender: 'not_specified',
    avatarUrl: kind === 'empty' ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="500"%3E%3Crect width="400" height="500" fill="%23E9DFD3"/%3E%3Ctext x="200" y="250" text-anchor="middle" font-size="100" fill="%23B5462A"%3EС%3C/text%3E%3C/svg%3E' : '/misha-questionnaire-v1.jpg',
    photos: kind === 'gallery' ? ['/misha-questionnaire-v1.jpg'] : [],
    bio: 'Люблю кофе и настолки. Ищу компанию для прогулок по выходным.', goal: 'walk', goals: ['walk', 'boardgames'],
    coordinates: [53.9, 27.5], areaName: 'Немига / Центр', preferredGender: 'all', preferredAgeRange: { min: 18, max: 99 },
    attendedCount: kind === 'new' ? 0 : count, hostedCount: kind === 'guest' || kind === 'new' ? 0 : 3,
    hostActive: true, isSupporter: kind === 'both' || kind === 'gallery', availableUntil: new Date(Date.now() + 3600000).toISOString()
  };
  return <main className="min-h-screen bg-zine-paper text-zine-ink p-3">
    <div className="mx-auto mb-3 flex max-w-[600px] flex-wrap items-center gap-2">
      <select aria-label="Ширина" className="h-11 bg-zine-card" value={width} onChange={e => setWidth(Number(e.target.value))}>{[360, 390, 430].map(w => <option key={w}>{w}</option>)}</select>
      <select aria-label="Карточка" className="h-11 bg-zine-card" value={kind} onChange={e => setKind(e.target.value)}><option value="both">Участие и организация</option><option value="guest">Только участие</option><option value="new">Без Сходок</option><option value="empty">Без фото</option><option value="gallery">Несколько фото</option></select>
      <select aria-label="Участие" className="h-11 bg-zine-card" value={count} onChange={e => setCount(Number(e.target.value))}>{[1, 2, 5, 8, 10, 123].map(n => <option key={n}>{n}</option>)}</select>
      <button className="min-h-11 px-3 bg-zine-card" onClick={() => { document.documentElement.classList.toggle('dark'); setDark(!dark); }}>{dark ? 'Светлая тема' : 'Тёмная тема'}</button>
      <button className="min-h-11 px-3 bg-zine-card" onClick={() => setLongName(!longName)}>Длинное имя</button>
    </div>
    <div className="mx-auto border border-zine-border" style={{ width: `min(100%, ${width}px)`, height: 720 }}>
      <PersonReel key={`${kind}-${count}`} user={user} tab="all" isFirst={true} myGoals={['walk']} onOpen={() => setOpen(true)} onReact={noop} onSkip={noop} />
    </div>
    {open && <UserBottomSheet user={user} onClose={() => setOpen(false)} onReact={noop} onReported={noop} />}
  </main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />);
