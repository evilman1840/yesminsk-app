import React, { useState } from 'react';
import { Check, Clock, MapPin, Pencil, Users, Eye, EyeOff, Send } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal, UserProfile, AppEvent, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { MinskMap } from '../components/map/MinskMap';
import { BottomSheet } from '../components/ui/BottomSheet';
import { GoalChips } from '../components/ui/GoalChips';
import { Logo } from '../components/ui/Logo';

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
    isProfileActive?: boolean;
  } | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile | null) => void;
  selectedGoal: ActivityGoal | 'all';
  onSelectGoal: (goal: ActivityGoal | 'all') => void;
  onOpenProfile: () => void;
  onToggleJoinEvent: (event: AppEvent) => void;
  onUpdateLocation?: (coords: [number, number]) => void;
}

export const formatEventDate = (isoString: string) => {
  try {
    const d = new Date(isoString);
    const day = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${day}, ${time}`;
  } catch {
    return isoString;
  }
};

export const MapScreen: React.FC<MapScreenProps> = ({
  users,
  events,
  currentUser,
  selectedUser,
  onSelectUser,
  selectedGoal,
  onSelectGoal,
  onOpenProfile,
  onToggleJoinEvent,
  onUpdateLocation
}) => {
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [isMySheetOpen, setIsMySheetOpen] = useState(false);

  const filteredUsers = selectedGoal === 'all' ? users : users.filter((u) => u.goal === selectedGoal);
  const isVisible = currentUser?.isProfileActive !== false;

  return (
    <div className="relative h-full w-full overflow-hidden bg-zine-paper">
      <MinskMap
        users={filteredUsers}
        events={events}
        currentUser={currentUser as any}
        selectedUser={selectedUser}
        onSelectUser={(u) => {
          setSelectedEvent(null);
          setIsMySheetOpen(false);
          onSelectUser(u);
        }}
        onSelectCurrentUser={() => {
          setSelectedEvent(null);
          onSelectUser(null);
          setIsMySheetOpen(true);
        }}
        onSelectEvent={(ev) => {
          onSelectUser(null);
          setIsMySheetOpen(false);
          setSelectedEvent(ev);
        }}
        onUpdateLocation={onUpdateLocation}
      />

      {/* Шапка поверх карты: логотип и фильтры */}
      <div className="absolute top-0 inset-x-0 z-20 pt-3 space-y-3 pointer-events-none">
        <div className="px-4 flex items-center justify-between">
          <div className="pointer-events-auto px-4 h-12 flex items-center rounded-full bg-zine-cardElevated shadow-zine">
            <Logo />
          </div>
          {!isVisible && (
            <button
              onClick={onOpenProfile}
              className="pointer-events-auto h-12 px-4 rounded-full bg-zine-plum text-white text-sm2 font-bold flex items-center gap-2 shadow-zine cursor-pointer"
            >
              <EyeOff size={18} />
              <span>Ты скрыт</span>
            </button>
          )}
        </div>
        <div className="pointer-events-auto">
          <GoalChips value={selectedGoal} onChange={onSelectGoal} floating />
        </div>
      </div>

      {/* Моя анкета на карте */}
      {isMySheetOpen && currentUser && (
        <BottomSheet title="Это ты" onClose={() => setIsMySheetOpen(false)}>
          <div className="flex items-center gap-4">
            <img
              src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={currentUser.name || 'Ты'}
              className="w-20 h-20 rounded-zine object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-serif font-bold text-title text-zine-ink truncate">{currentUser.name}</p>
              <p className="text-sm2 text-zine-inkMuted truncate">{currentUser.area}</p>
            </div>
          </div>

          <div className={`mt-4 p-3.5 rounded-zine-sm flex items-center gap-3 text-sm2 ${isVisible ? 'bg-zine-sage/15 text-zine-ink' : 'bg-zine-plum/10 text-zine-ink'}`}>
            {isVisible ? <Eye size={22} className="text-zine-sage shrink-0" /> : <EyeOff size={22} className="text-zine-plum shrink-0" />}
            <span>{isVisible ? 'Тебя видят на карте. Точный адрес скрыт — метка смещена на 300–500 м.' : 'Режим невидимки: другие тебя не видят.'}</span>
          </div>

          <button
            onClick={() => {
              setIsMySheetOpen(false);
              onOpenProfile();
            }}
            className="mt-4 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
          >
            <Pencil size={20} />
            <span>Изменить анкету</span>
          </button>
        </BottomSheet>
      )}

      {/* Сходка на карте */}
      {selectedEvent && (
        <BottomSheet title={selectedEvent.title} onClose={() => setSelectedEvent(null)}>
          <EventDetails
            event={selectedEvent}
            onToggleJoin={() => {
              onToggleJoinEvent(selectedEvent);
              setSelectedEvent({ ...selectedEvent, isJoined: !selectedEvent.isJoined });
            }}
          />
        </BottomSheet>
      )}
    </div>
  );
};

/**
 * Подробности сходки: когда, где, кто собирает и кнопка участия
 */
const EventDetails: React.FC<{ event: AppEvent; onToggleJoin: () => void }> = ({ event, onToggleJoin }) => {
  const cat = EVENT_CATEGORIES_CONFIG[event.category];

  return (
    <div className="space-y-3">
      {cat && (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold ${cat.badgeBg} ${cat.badgeText}`}>
          <span>{cat.emoji}</span>
          <span>{cat.label}</span>
        </span>
      )}

      <div className="space-y-2 text-body text-zine-ink">
        <p className="flex items-center gap-2.5">
          <Clock size={20} className="text-zine-terracotta shrink-0" />
          <span className="font-semibold">{formatEventDate(event.dateTime)}</span>
        </p>
        <p className="flex items-center gap-2.5">
          <MapPin size={20} className="text-zine-terracotta shrink-0" />
          <span>{event.locationName}</span>
        </p>
        <p className="flex items-center gap-2.5 text-zine-inkMuted">
          <Users size={20} className="shrink-0" />
          <span>Идут: {event.participantsCount || 1}</span>
        </p>
      </div>

      {event.description && <p className="text-body text-zine-ink whitespace-pre-line">{event.description}</p>}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => {
            telegramService.haptic('medium');
            onToggleJoin();
          }}
          className={`flex-1 h-12 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${
            event.isJoined ? 'bg-zine-sage/15 text-zine-sage' : 'bg-zine-terracotta text-white'
          }`}
        >
          {event.isJoined ? (
            <>
              <Check size={20} strokeWidth={3} />
              <span>Я иду</span>
            </>
          ) : (
            <span>Пойду!</span>
          )}
        </button>
        {event.creator?.username && (
          <button
            onClick={() => {
              telegramService.haptic('medium');
              telegramService.openChat(event.creator.username);
            }}
            aria-label="Написать организатору"
            className="h-12 px-4 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Send size={20} />
            <span>Организатору</span>
          </button>
        )}
      </div>
      {event.isJoined && <p className="text-cap text-zine-inkMuted text-center">Передумал? Нажми «Я иду» ещё раз, чтобы отменить</p>}
    </div>
  );
};

export default MapScreen;
