import React, { useState } from 'react';
import { Notice, NoticeBar, NoticeHelpList } from '../components/common/NoticeBar';
import { BottomSheet } from '../components/ui/BottomSheet';
import { TabBar } from '../components/ui/TabBar';

/** Isolated UI preview: synthetic data, no API, no analytics sender. */
export function NoticePreview() {
  const [help, setHelp] = useState(false);
  const [opened, setOpened] = useState(false);
  const [kind, setKind] = useState<'meetup' | 'bot' | 'empty'>('meetup');
  const notices: Notice[] = [
    { id: 'preview-meetup', kind: 'meetup', text: '👯 Александра идёт на «Настолки и знакомство в большой компании» завтра в 19:00', headline: '🎲 Настолки и знакомство в большой компании', detail: 'завтра в 19:00 · Александра идёт', action: 'Пойдёшь? →', hideDays: 1, onClick: () => setOpened(true) },
    { id: 'preview-bot', kind: 'bot', text: '🔔 Бот не может тебе писать: не узнаешь о сходках и приветах', action: 'Разрешить →', hideDays: 3, onClick: () => setOpened(true) },
    { id: 'preview-safety', kind: 'safety', text: '🛡 Как пожаловаться на неприятное поведение в Telegram', action: 'Подробнее', hideDays: 30, onClick: () => setOpened(true) }
  ];
  return <main className="h-[100dvh] flex flex-col bg-zine-paper text-zine-ink">
    <section className="flex-1 min-h-0 overflow-auto px-4 pt-6">
      <h1 className="font-serif text-display font-bold">Сходки</h1>
      <p className="mt-3 text-sm2 text-zine-inkMuted">Локальный просмотр на выдуманных данных</p>
      <div className="flex flex-wrap gap-2 my-4">
        <button className="min-h-11 px-3 rounded-zine-sm bg-zine-card" onClick={() => { localStorage.removeItem('yesminsk_notice_snoozed_until'); localStorage.removeItem('yesminsk_notice_hidden'); location.reload(); }}>Сбросить</button>
        <button className="min-h-11 px-3 rounded-zine-sm bg-zine-card" onClick={() => document.documentElement.classList.toggle('dark')}>Тема</button>
        <button className="min-h-11 px-3 rounded-zine-sm bg-zine-card" onClick={() => setKind('bot')}>Бот</button>
        <button className="min-h-11 px-3 rounded-zine-sm bg-zine-card" onClick={() => setKind('empty')}>Нет подсказки</button>
      </div>
      <div className="p-4 rounded-zine bg-zine-card border border-zine-border">
        <p className="font-serif text-title font-bold">Настолки и чай</p>
        <p className="mt-2 text-body">Завтра, 19:00 · Комаровка</p>
        <p className="mt-2 text-sm2 text-zine-inkMuted">Играем в простые настолки. Правила объясним на месте.</p>
        <button className="mt-4 min-h-11 w-full rounded-zine-sm bg-zine-terracotta text-white font-bold" onClick={() => setOpened(true)}>Открыть сходку</button>
      </div>
      <button className="my-4 min-h-11 w-full rounded-zine-sm border border-zine-border bg-zine-card font-semibold" onClick={() => setHelp(true)}>💡 Подсказки</button>
    </section>
    <NoticeBar notices={kind === 'empty' ? [] : [notices[kind === 'bot' ? 1 : 0]]} />
    <TabBar current="events" onNavigate={() => {}} />
    {help && <BottomSheet title="Подсказки" onClose={() => setHelp(false)}><NoticeHelpList notices={notices} onClose={() => setHelp(false)} /></BottomSheet>}
    {opened && <BottomSheet title="Настолки и чай" onClose={() => setOpened(false)}><p className="text-body">Открылась карточка сходки. Основное действие доступно.</p></BottomSheet>}
  </main>;
}
