import React from 'react';
import { Map, Users, CalendarDays, CircleUser, MapPin } from 'lucide-react';
import { telegramService } from '../../services/telegram';

export type TabId = 'main' | 'feed' | 'events' | 'places' | 'news' | 'profile_edit';

const TABS: { id: TabId; label: string; Icon: React.FC<any> }[] = [
  { id: 'main', label: 'Карта', Icon: Map },
  { id: 'feed', label: 'Люди', Icon: Users },
  { id: 'events', label: 'Сходки', Icon: CalendarDays },
  { id: 'places', label: 'Места', Icon: MapPin },
  { id: 'profile_edit', label: 'Я', Icon: CircleUser }
];

/**
 * Нижнее меню: крупные значки и подписи, в которые легко попасть пальцем
 */
export const TabBar: React.FC<{
  current: TabId;
  onNavigate: (tab: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
}> = ({ current, onNavigate, badges = {} }) => (
  <nav className="shrink-0 bg-zine-cardElevated border-t border-zine-border flex items-stretch justify-around px-1 pt-1.5 pb-safe z-40">
    {TABS.map(({ id, label, Icon }) => {
      const isActive = current === id;
      const badge = badges[id] || 0;
      return (
        <button
          key={id}
          onClick={() => {
            if (isActive) return;
            telegramService.haptic('selection');
            onNavigate(id);
          }}
          className={`relative flex-1 min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-zine-sm transition-colors cursor-pointer ${
            isActive ? 'text-zine-terracotta' : 'text-zine-inkMuted active:bg-zine-card'
          }`}
          aria-current={isActive ? 'page' : undefined}
        >
          <span
            className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
              isActive ? 'bg-zine-terracotta/10' : ''
            }`}
          >
            <Icon size={26} strokeWidth={isActive ? 2.3 : 1.9} />
          </span>
          <span className={`text-cap ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
          {badge > 0 && (
            <span className="absolute top-0.5 left-1/2 ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-zine-terracotta text-white text-cap font-bold flex items-center justify-center border-2 border-zine-cardElevated">
              {badge}
            </span>
          )}
        </button>
      );
    })}
  </nav>
);
