import React, { useState } from 'react';
import { Compass, Users, User, Calendar, Send } from 'lucide-react';
import { UserProfile, GOALS_CONFIG, ActivityGoal } from '../types';
import { telegramService } from '../services/telegram';

interface FeedScreenProps {
  users: UserProfile[];
  eventsCount?: number;
  onSelectUser: (user: UserProfile) => void;
  onOpenMap: () => void;
  onOpenFeed?: () => void;
  onOpenEvents: () => void;
  onOpenProfile: () => void;
  currentArea: string;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  users,
  eventsCount = 0,
  onSelectUser,
  onOpenMap,
  onOpenEvents,
  onOpenProfile,
  currentArea
}) => {
  const [selectedGoal, setSelectedGoal] = useState<ActivityGoal | 'all'>('all');

  const filteredUsers = selectedGoal === 'all'
    ? users
    : users.filter((u) => u.goal === selectedGoal);

  const handleGoalFilter = (goal: ActivityGoal | 'all') => {
    telegramService.haptic('selection');
    setSelectedGoal(goal);
  };

  const handleCardClick = (user: UserProfile) => {
    telegramService.haptic('selection');
    onSelectUser(user);
  };

  const handleQuickTelegram = (e: React.MouseEvent, username?: string) => {
    e.stopPropagation();
    telegramService.haptic('medium');
    telegramService.openChat(username);
  };

  return (
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-hidden select-none bg-zine-paper">
      
      {/* Компактная шапка */}
      <header className="px-4 py-2.5 bg-zine-paper/95 backdrop-blur-md border-b border-zine-border/80 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-zine-terracotta text-white flex items-center justify-center font-serif font-bold text-xs shadow-zine-sm">
            Y
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-bold text-[16px] tracking-tight text-zine-ink">
              YesMinsk
            </span>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zine-inkMuted">
              Люди рядом
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zine-card border border-zine-border text-xs text-zine-ink shadow-zine-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-zine-terracotta" />
          <span className="font-medium text-[11px] text-zine-ink truncate max-w-[140px]">{currentArea}</span>
        </div>
      </header>

      {/* Фильтр целей */}
      <div className="px-3 py-2 bg-zine-paper/90 border-b border-zine-border flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => handleGoalFilter('all')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shadow-zine-sm border ${
            selectedGoal === 'all'
              ? 'bg-zine-terracotta text-white border-zine-terracotta'
              : 'bg-zine-cardElevated text-zine-ink border-zine-border'
          }`}
        >
          Все ({users.length})
        </button>

        {(Object.keys(GOALS_CONFIG) as ActivityGoal[]).map((key) => {
          const item = GOALS_CONFIG[key];
          const isActive = selectedGoal === key;
          const count = users.filter((u) => u.goal === key).length;

          return (
            <button
              key={key}
              onClick={() => handleGoalFilter(key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all shadow-zine-sm border ${
                isActive
                  ? 'bg-zine-terracotta text-white border-zine-terracotta'
                  : 'bg-zine-cardElevated text-zine-ink border-zine-border'
              }`}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
              <span className={`text-[9.5px] ml-0.5 opacity-80 ${isActive ? 'text-white' : 'text-zine-inkMuted'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Лента карточек (Журнальный стиль) */}
      <main className="flex-1 overflow-y-auto p-3.5 space-y-3 pb-20">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-zine-inkMuted">
            <p className="font-serif text-sm">В этой категории пока никого нет.</p>
            <p className="text-xs mt-1">Попробуй переключить цель выше!</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const goalConfig = GOALS_CONFIG[user.goal] || { emoji: '☕️', label: 'Досуг', badgeBg: 'bg-stone-100', badgeBorder: 'border-stone-300', badgeText: 'text-stone-800' };

            return (
              <div
                key={user.id}
                onClick={() => handleCardClick(user)}
                className="p-3.5 rounded-2xl bg-zine-card border border-zine-border shadow-zine hover:shadow-zine-lg transition-all active:scale-[0.99] cursor-pointer relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-28 h-28 rounded-full ${goalConfig.badgeBg} opacity-40 blur-2xl pointer-events-none`} />

                <div className="flex gap-3 items-start relative z-10">
                  <div className="relative shrink-0">
                    <img
                      src={user.avatarUrl}
                      alt={user.firstName}
                      className="w-14 h-14 rounded-2xl object-cover border border-zine-border shadow-sm"
                    />
                    <span className="absolute -bottom-1 -right-1 text-xs bg-white rounded-full p-0.5 border border-zine-border shadow-sm">
                      {goalConfig.emoji}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <h3 className="font-serif font-bold text-[15px] text-zine-ink truncate">
                          {user.firstName}
                        </h3>
                        <span className="text-[11px] text-zine-inkMuted truncate">
                          • {user.isTourist ? 'Турист(ка)' : user.areaName}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-zine-terracotta bg-zine-terracotta/10 px-2 py-0.5 rounded-full shrink-0">
                        ~{user.distanceMeters || 300} м
                      </span>
                    </div>

                    <div className="mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${goalConfig.badgeBg} ${goalConfig.badgeBorder} ${goalConfig.badgeText}`}>
                        <span>{goalConfig.emoji}</span>
                        <span>{goalConfig.label}</span>
                      </span>
                    </div>

                    <p className="text-xs text-zine-ink/90 leading-relaxed line-clamp-2 mb-2.5">
                      {user.bio || 'Ищу дружескую компанию для прогулок по городу.'}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-zine-border/50">
                      <span className="text-[10px] text-zine-inkMuted">
                        Нажми, чтобы открыть анкету
                      </span>
                      {user.username && (
                        <button
                          onClick={(e) => handleQuickTelegram(e, user.username)}
                          className="py-1 px-2.5 rounded-lg bg-zine-terracotta/10 hover:bg-zine-terracotta text-zine-terracotta hover:text-white font-semibold text-[10.5px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Send size={11} />
                          <span>@{user.username}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* 4-кнопочный TabBar */}
      <nav className="h-14 bg-zine-paper/95 backdrop-blur-md border-t border-zine-border flex items-center justify-around px-2 z-20 shrink-0">
        <button
          onClick={onOpenMap}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <Compass size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Карта</span>
        </button>

        <button className="flex flex-col items-center gap-0.5 text-zine-terracotta cursor-pointer">
          <Users size={18} strokeWidth={2.4} />
          <span className="text-[9px] font-bold">Люди ({users.length})</span>
        </button>

        <button
          onClick={onOpenEvents}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <Calendar size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">События ({eventsCount})</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <User size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Профиль</span>
        </button>
      </nav>

    </div>
  );
};

export default FeedScreen;
