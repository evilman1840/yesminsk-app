import React from 'react';
import { Compass, Users, User, ChevronDown } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal, UserProfile } from '../types';
import { telegramService } from '../services/telegram';
import { MinskMap } from '../components/map/MinskMap';

interface MapScreenProps {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile | null) => void;
  selectedGoal: ActivityGoal | 'all';
  onSelectGoal: (goal: ActivityGoal | 'all') => void;
  onOpenProfile: () => void;
  onOpenFeed: () => void;
  currentArea: string;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  users,
  selectedUser,
  onSelectUser,
  selectedGoal,
  onSelectGoal,
  onOpenProfile,
  onOpenFeed,
  currentArea
}) => {
  const filteredUsers = selectedGoal === 'all' 
    ? users 
    : users.filter(u => u.goal === selectedGoal);

  return (
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-hidden relative">
      
      {/* 1. Ультра-компактная шапка в одну строку */}
      <header className="px-4 py-2.5 bg-zine-paper/95 backdrop-blur-md border-b border-zine-border/80 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-zine-terracotta text-white flex items-center justify-center font-serif font-bold text-xs shadow-zine-sm">
            Y
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-bold text-[16px] tracking-tight text-zine-ink">
              YesMinsk
            </span>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zine-inkMuted">
              без дейтинга
            </span>
          </div>
        </div>

        {/* Селектор района */}
        <button 
          onClick={() => telegramService.haptic('selection')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zine-card border border-zine-border text-xs text-zine-ink shadow-zine-sm hover:border-zine-terracotta/40 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-zine-terracotta" />
          <span className="font-medium text-[11px] text-zine-ink">{currentArea}</span>
          <ChevronDown size={11} className="text-zine-inkMuted" />
        </button>
      </header>

      {/* Тонкая строка слогана */}
      <div className="px-4 py-0.5 bg-zine-card/70 border-b border-zine-border/60 flex items-center justify-between text-[9px] text-zine-inkMuted tracking-wide font-medium">
        <span>Минск для людей • прогулки, кофе и досуг</span>
        <span className="text-zine-terracotta font-semibold">только платоника</span>
      </div>

      {/* 2. Карта с фильтрами */}
      <div className="flex-1 relative bg-[#F4EFE7] overflow-hidden">
        
        {/* Изящные фильтры целей */}
        <div className="absolute top-2.5 inset-x-3 flex gap-1.5 overflow-x-auto no-scrollbar z-20 py-0.5">
          <button
            onClick={() => {
              telegramService.haptic('selection');
              onSelectGoal('all');
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all shadow-zine-sm border ${
              selectedGoal === 'all'
                ? 'bg-zine-terracotta text-white border-zine-terracotta shadow-sm'
                : 'bg-zine-cardElevated/95 backdrop-blur-sm text-zine-ink border-zine-border hover:bg-white'
            }`}
          >
            Все ({users.length})
          </button>
          
          {(Object.keys(GOALS_CONFIG) as ActivityGoal[]).map((key) => {
            const item = GOALS_CONFIG[key];
            const isActive = selectedGoal === key;
            return (
              <button
                key={key}
                onClick={() => {
                  telegramService.haptic('selection');
                  onSelectGoal(key);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 transition-all shadow-zine-sm border ${
                  isActive
                    ? 'bg-zine-terracotta text-white border-zine-terracotta shadow-sm'
                    : 'bg-zine-cardElevated/95 backdrop-blur-sm text-zine-ink border-zine-border hover:bg-white'
                }`}
              >
                <span className="text-[12px]">{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Интерактивная карта Leaflet */}
        <MinskMap
          users={filteredUsers}
          selectedUser={selectedUser}
          onSelectUser={onSelectUser}
        />
      </div>

      {/* 3. Компактный нижний TabBar */}
      <nav className="h-14 bg-zine-paper/95 backdrop-blur-md border-t border-zine-border flex items-center justify-around px-4 z-30 shrink-0">
        <button
          className="flex flex-col items-center gap-0.5 text-zine-terracotta"
        >
          <Compass size={19} strokeWidth={2.4} />
          <span className="text-[9.5px] font-bold">Карта</span>
        </button>

        <button
          onClick={onOpenFeed}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink"
        >
          <Users size={19} strokeWidth={1.8} />
          <span className="text-[9.5px] font-medium">Люди ({users.length})</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink"
        >
          <User size={19} strokeWidth={1.8} />
          <span className="text-[9.5px] font-medium">Профиль</span>
        </button>
      </nav>

    </div>
  );
};
