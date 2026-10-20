import React, { useState } from 'react';
import { Compass, Users, User, Calendar, Send, ShieldCheck, Clock, MapPin, X, Check, Edit3 } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal, UserProfile, AppEvent, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { MinskMap } from '../components/map/MinskMap';
import { ReactionButtons, ChatButton, ReactionType } from '../components/common/Reactions';

export interface MapScreenProps {
  users: UserProfile[];
  events: AppEvent[];
  currentUser?: {
    telegramId?: number;
    name?: string;
    username?: string;
    avatarUrl?: string;
    goal?: ActivityGoal;
    area?: string;
    coordinates?: [number, number];
    bio?: string;
    age?: string | number;
  } | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile | null) => void;
  selectedGoal: ActivityGoal | 'all';
  onSelectGoal: (goal: ActivityGoal | 'all') => void;
  onOpenProfile: () => void;
  onOpenFeed: () => void;
  onOpenEvents: () => void;
  onToggleJoinEvent: (event: AppEvent) => void;
  currentArea: string;
  onUpdateLocation?: (coords: [number, number]) => void;
  onUpdateUserCoordinates?: (coords: [number, number]) => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  inboxCount?: number;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  users,
  events,
  currentUser,
  selectedUser,
  onSelectUser,
  selectedGoal,
  onSelectGoal,
  onOpenProfile,
  onOpenFeed,
  onOpenEvents,
  onToggleJoinEvent,
  currentArea,
  onUpdateLocation,
  onUpdateUserCoordinates,
  onReact,
  inboxCount = 0
}) => {
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [isCurrentUserSheetOpen, setIsCurrentUserSheetOpen] = useState(false);
  const handleLocationUpdate = onUpdateLocation || onUpdateUserCoordinates;

  const filteredUsers = selectedGoal === 'all'
    ? users
    : users.filter((u) => u.goal === selectedGoal);

  const handleOpenTelegram = (username?: string) => {
    telegramService.haptic('medium');
    telegramService.openChat(username);
  };

  const formatEventDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('ru-RU', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-hidden relative select-none bg-zine-paper">
      
      {/* 1. Компактная шапка в одну строку */}
      <header className="px-4 py-2.5 bg-zine-paper/95 backdrop-blur-md border-b border-zine-border/80 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-zine-terracotta text-white flex items-center justify-center font-serif font-bold text-xs shadow-zine-sm">
            Y
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-bold text-[16px] tracking-tight text-zine-ink">
              YesMinsk
            </span>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zine-inkMuted hidden sm:inline">
              без дейтинга
            </span>
          </div>
        </div>

        {/* Район / индикатор */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zine-card border border-zine-border text-xs text-zine-ink shadow-zine-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-zine-terracotta" />
          <span className="font-medium text-[11px] text-zine-ink truncate max-w-[140px]">{currentArea}</span>
        </div>
      </header>

      {/* Тонкий деликатный слоган */}
      <div className="px-4 py-0.5 bg-zine-card/70 border-b border-zine-border/60 flex items-center justify-between text-[9px] text-zine-inkMuted tracking-wide font-medium shrink-0">
        <span>Минск для людей • прогулки, сходки и досуг</span>
        <span className="text-zine-terracotta font-semibold">только платоника</span>
      </div>

      {/* 2. Карта с фильтрами */}
      <div className="flex-1 relative bg-[#F4EFE7] overflow-hidden">
        
        {/* Фильтры целей поверх карты */}
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
            Все люди ({users.length})
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

        {/* Интерактивная карта Яндекс */}
        <MinskMap
          users={filteredUsers}
          events={events}
          currentUser={currentUser}
          selectedUser={selectedUser}
          onSelectUser={(u) => {
            setSelectedEvent(null);
            setIsCurrentUserSheetOpen(false);
            onSelectUser(u);
          }}
          onSelectCurrentUser={() => {
            setSelectedEvent(null);
            onSelectUser(null);
            setIsCurrentUserSheetOpen(true);
          }}
          onSelectEvent={(ev) => {
            onSelectUser(null);
            setIsCurrentUserSheetOpen(false);
            setSelectedEvent(ev);
          }}
          onUpdateLocation={handleLocationUpdate}
          onUpdateUserCoordinates={handleLocationUpdate}
        />

        {/* Шторка текущего пользователя ("⭐️ Твой профиль на карте") */}
        {isCurrentUserSheetOpen && currentUser && (
          <div className="absolute bottom-2 inset-x-2.5 bg-zine-cardElevated rounded-zine border-2 border-zine-terracotta p-3.5 shadow-zine-float z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="w-8 h-1 rounded-full bg-zine-terracotta/40 mx-auto mb-2.5" />

            <div className="flex gap-3 items-start">
              <div className="relative shrink-0">
                <img
                  src={
                    currentUser.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                  }
                  alt={currentUser.name || 'Ты'}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-zine-terracotta shadow-md"
                />
                <span className="absolute -top-2 -right-1 bg-zine-terracotta text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                  ⭐️ ТЫ
                </span>
                <span className="absolute -bottom-1 -right-1 text-xs bg-white rounded-full p-0.5 border border-zine-border shadow-sm">
                  {GOALS_CONFIG[currentUser.goal || 'walk']?.emoji || '☕️'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-baseline gap-1.5 truncate">
                    <h3 className="font-serif font-bold text-[15px] text-zine-ink leading-tight truncate">
                      {currentUser.name || 'Твой профиль'}
                    </h3>
                    <span className="text-[11px] text-zine-inkMuted font-medium truncate">
                      {currentUser.area || currentArea}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-zine-terracotta bg-zine-terracotta/15 px-2 py-0.5 rounded-full shrink-0">
                    Это ты
                  </span>
                </div>

                <div className="mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      GOALS_CONFIG[currentUser.goal || 'walk']?.badgeBg
                    } ${GOALS_CONFIG[currentUser.goal || 'walk']?.badgeBorder} ${
                      GOALS_CONFIG[currentUser.goal || 'walk']?.badgeText
                    }`}
                  >
                    <span>{GOALS_CONFIG[currentUser.goal || 'walk']?.emoji}</span>
                    <span>{GOALS_CONFIG[currentUser.goal || 'walk']?.label}</span>
                  </span>
                </div>

                <p className="text-[11.5px] text-zinc-700 leading-snug mb-3">
                  {currentUser.bio || 'Твоя анкета видна другим участникам в Минске.'}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      telegramService.haptic('selection');
                      setIsCurrentUserSheetOpen(false);
                      onOpenProfile();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-zine-terracotta hover:bg-zine-terracottaHover text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Редактировать анкету</span>
                  </button>
                  <button
                    onClick={() => setIsCurrentUserSheetOpen(false)}
                    className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Шторка выбранного участника */}
        {selectedUser && (
          <div className="absolute bottom-2 inset-x-2.5 bg-zine-cardElevated rounded-zine border border-zine-border p-3.5 shadow-zine-float z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="w-8 h-1 rounded-full bg-zine-border mx-auto mb-2.5" />
            
            <div className="flex gap-3 items-start">
              <div className="relative shrink-0">
                <img
                  src={selectedUser.avatarUrl}
                  alt={selectedUser.firstName}
                  className="w-14 h-14 rounded-2xl object-cover border border-zine-border/80"
                />
                <span className="absolute top-10 -right-1 text-xs bg-white rounded-full p-0.5 border border-zine-border shadow-sm">
                  {GOALS_CONFIG[selectedUser.goal]?.emoji || '☕️'}
                </span>
                <ReactionButtons user={selectedUser} onReact={onReact} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-baseline gap-1.5 truncate">
                    <h3 className="font-serif font-bold text-[15px] text-zine-ink leading-tight truncate">
                      {selectedUser.firstName}
                    </h3>
                    <span className="text-[11px] text-zine-inkMuted font-medium truncate">
                      {selectedUser.isTourist ? 'Турист(ка)' : selectedUser.areaName}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-zine-terracotta bg-zine-terracotta/10 px-2 py-0.5 rounded-full shrink-0">
                    ~{selectedUser.distanceMeters || 300} м
                  </span>
                </div>

                <div className="mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${GOALS_CONFIG[selectedUser.goal]?.badgeBg} ${GOALS_CONFIG[selectedUser.goal]?.badgeBorder} ${GOALS_CONFIG[selectedUser.goal]?.badgeText}`}>
                    <span>{GOALS_CONFIG[selectedUser.goal]?.emoji}</span>
                    <span>{GOALS_CONFIG[selectedUser.goal]?.label}</span>
                  </span>
                </div>

                <p className="text-[11.5px] text-zine-ink/90 leading-snug mb-3">
                  {selectedUser.bio || 'Привет! Ищу дружескую компанию.'}
                </p>

                <div className="flex gap-2">
                  <ChatButton user={selectedUser} className="flex-1 min-w-0" />
                  <button
                    onClick={() => onSelectUser(null)}
                    className="p-2 rounded-xl bg-zine-card border border-zine-border text-zine-inkMuted hover:text-zine-ink"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1 text-[9px] text-zine-inkMuted mt-1.5">
                  <ShieldCheck size={11} className="text-zine-sage" />
                  <span>Координаты смещены на 300м ради приватности</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Шторка выбранного события (сходки) */}
        {selectedEvent && (
          <div className="absolute bottom-2 inset-x-2.5 bg-zine-cardElevated rounded-zine border border-zine-border p-3.5 shadow-zine-float z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="w-8 h-1 rounded-full bg-zine-border mx-auto mb-2" />
            
            <div className="flex items-start justify-between mb-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF4E6] text-[#B87C24] border border-[#F3E2B8]">
                <span>{EVENT_CATEGORIES_CONFIG[selectedEvent.category]?.emoji || '⭐️'}</span>
                <span>Сходка в Минске</span>
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>

            <h3 className="font-serif font-bold text-[15px] text-zinc-900 leading-tight mb-1">
              {selectedEvent.title}
            </h3>

            <div className="flex items-center gap-3 text-[11px] text-zinc-600 mb-2">
              <span className="flex items-center gap-1 text-zine-terracotta font-semibold">
                <Clock size={11} strokeWidth={2.4} />
                <span>{formatEventDate(selectedEvent.dateTime)}</span>
              </span>
              <span className="flex items-center gap-1 truncate">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{selectedEvent.locationName}</span>
              </span>
            </div>

            <p className="text-[11.5px] text-zinc-700 leading-snug line-clamp-3 mb-3">
              {selectedEvent.description}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onToggleJoinEvent(selectedEvent);
                  setSelectedEvent({ ...selectedEvent, isJoined: !selectedEvent.isJoined });
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer ${
                  selectedEvent.isJoined
                    ? 'bg-zine-sage text-white'
                    : 'bg-zine-terracotta hover:bg-zine-terracottaHover text-white'
                }`}
              >
                {selectedEvent.isJoined ? (
                  <>
                    <Check size={13} strokeWidth={3} />
                    <span>Ты идёшь (Отменить)</span>
                  </>
                ) : (
                  <span>Присоединиться к сходке →</span>
                )}
              </button>

              {selectedEvent.creator?.username && (
                <button
                  onClick={() => handleOpenTelegram(selectedEvent.creator.username)}
                  className="py-2 px-3 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-700 hover:text-zinc-900 font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                  title="Написать организатору"
                >
                  <Send size={12} />
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* 3. Нижний 4-кнопочный TabBar */}
      <nav className="h-14 bg-zine-paper/95 backdrop-blur-md border-t border-zine-border flex items-center justify-around px-2 z-30 shrink-0">
        <button className="flex flex-col items-center gap-0.5 text-zine-terracotta cursor-pointer">
          <Compass size={18} strokeWidth={2.4} />
          <span className="text-[9px] font-bold">Карта</span>
        </button>

        <button
          onClick={onOpenFeed}
          className="relative flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <Users size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Люди ({users.length})</span>
          {inboxCount > 0 && (
            <span className="absolute -top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-zine-terracotta text-white text-[9px] font-bold flex items-center justify-center">
              {inboxCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenEvents}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <Calendar size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">События ({events.length})</span>
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

export default MapScreen;
