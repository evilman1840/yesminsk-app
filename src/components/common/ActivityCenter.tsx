import React from 'react';
import { ChevronRight } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { thumb, isOwnPhoto } from '../../utils/thumb';

export const ActivityButton: React.FC<{
  avatarUrl?: string; name: string; unread: number; onClick: () => void; size?: number;
}> = ({ avatarUrl, name, unread, onClick, size = 44 }) => (
  <button type="button" onClick={() => { telegramService.haptic('selection'); onClick(); }}
    aria-label={unread ? `Для тебя: новых событий ${unread}` : 'Для тебя: уведомления и новости'}
    className="relative shrink-0 rounded-full border-2 border-zine-border bg-zine-card grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta"
    style={{ width: Math.max(44, size), height: Math.max(44, size) }}>
    {isOwnPhoto(avatarUrl) ? <img src={thumb(avatarUrl)} alt="" className="w-full h-full rounded-full object-cover" />
      : <span aria-hidden="true" className="font-serif text-title font-bold text-zine-ink">{name?.trim().slice(0, 1) || 'Я'}</span>}
    {unread > 0 && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-zine-terracotta ring-2 ring-zine-paper" />}
  </button>
);

const ActivityRow: React.FC<{ emoji: string; title: string; text: string; count?: number; onClick: () => void }> = ({ emoji, title, text, count, onClick }) => (
  <button type="button" onClick={() => { telegramService.haptic('selection'); onClick(); }}
    className="w-full min-h-14 p-3 flex items-center gap-3 text-left rounded-zine-sm bg-zine-card border border-zine-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">
    <span aria-hidden="true" className="text-[26px] shrink-0">{emoji}</span>
    <span className="flex-1 min-w-0"><span className="block text-body font-bold text-zine-ink">{title}</span><span className="block mt-0.5 text-sm2 text-zine-inkMuted">{text}</span></span>
    {count > 0 && <span className="shrink-0 font-bold text-body text-zine-terracotta tabular-nums">{count}</span>}
    <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-zine-inkMuted" />
  </button>
);

export const ActivitySheet: React.FC<{
  likes: number; matches: number; meetups: number; unreadNews: number; latestNews?: string;
  onLikes: () => void; onMatches: () => void; onMeetups: () => void; onNews: () => void; onClose: () => void;
}> = ({ likes, matches, meetups, unreadNews, latestNews, onLikes, onMatches, onMeetups, onNews, onClose }) => (
  <BottomSheet title="Для тебя" onClose={onClose}>
    <div className="space-y-3">
      {likes > 0 && <ActivityRow emoji="👋" title="Тебе передали привет" text="Посмотри, кто хочет пообщаться" count={likes} onClick={onLikes} />}
      {matches > 0 && <ActivityRow emoji="🤝" title="Вы на связи" text="Можно написать или позвать на сходку" count={matches} onClick={onMatches} />}
      <ActivityRow emoji="📍" title={meetups ? 'Новые сходки' : 'Сходки'} text={meetups ? 'Посмотри, куда собирается компания' : 'Выбери встречу или собери свою'} count={meetups || undefined} onClick={onMeetups} />
      {!likes && !matches && !meetups && <p className="text-sm2 text-zine-inkMuted">Личных событий пока нет. Передай кому-нибудь 👋 или загляни на сходки.</p>}
      <button type="button" onClick={() => { telegramService.haptic('selection'); onNews(); }}
        className="w-full p-4 rounded-zine bg-zine-cardElevated border border-zine-border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">
        <span className="flex items-center gap-3">
          <img src="/misha-questionnaire-v1.jpg" alt="Миша Спасатель" className="w-11 h-11 shrink-0 rounded-full object-cover" />
          <span className="flex-1 min-w-0"><span className="block font-bold text-body text-zine-ink">Новости от Миши</span><span className="block text-cap text-zine-inkMuted">Что нового в ГУЛЯЙ!</span></span>
          {unreadNews > 0 && <span className="shrink-0 text-body font-bold text-zine-terracotta">{unreadNews}</span>}
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-zine-inkMuted" />
        </span>
        <span className="block mt-3 text-sm2 text-zine-inkMuted line-clamp-3 whitespace-pre-line">{latestNews || 'Новости проекта, планы и отчёты о донатах'}</span>
      </button>
    </div>
  </BottomSheet>
);
