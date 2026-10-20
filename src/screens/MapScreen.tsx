import React, { useState } from 'react';
import { Check, Clock, MapPin, Pencil, Users, Eye, EyeOff, Send, Sun, Moon } from 'lucide-react';
import { GOALS_CONFIG, ActivityGoal, UserProfile, AppEvent, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { MinskMap } from '../components/map/MinskMap';
import { BottomSheet } from '../components/ui/BottomSheet';
import { GoalChips } from '../components/ui/GoalChips';
import { Logo } from '../components/ui/Logo';
import { EventDetails } from '../components/common/EventDetails';

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

// Подсказки для новичков: коротко — в бегущей строке, подробно — в шторке «Как это работает»
const TIPS_LINE =
  '👋 Впервые здесь? Нажми, чтобы узнать, как всё устроено  ·  Нажми на фото на карте — откроется анкета  ·  «Пообщаться» — передай привет  ·  «Сходки» — найди компанию или собери свою  ·  Заполни анкету во вкладке «Я»';

const HELP_STEPS = [
  { emoji: '🗺', title: 'Люди и сходки рядом', text: 'На карте видно, кто рядом и какие встречи скоро. Нажми на фото — откроется анкета.' },
  { emoji: '👋', title: '«Пообщаться»', text: 'Передай человеку привет. Если он ответит тем же, вы сможете написать друг другу в Telegram.' },
  { emoji: '🗓', title: 'Сходки', text: 'Присоединяйся к прогулкам и встречам или собери свою компанию — это займёт минуту.' },
  { emoji: '✏️', title: 'Твоя анкета', text: 'Во вкладке «Я» добавь фото и пару слов о себе — так тебя быстрее заметят.' },
  { emoji: '🛡', title: 'Безопасно', text: 'Твоя метка на карте смещена на 300–500 м. Можно включить режим невидимки.' }
];

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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => telegramService.isDarkTheme());

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
        <div className="px-4 flex items-center gap-2">
          <div className="pointer-events-auto shrink-0 px-4 h-12 flex items-center rounded-full bg-zine-cardElevated shadow-zine">
            <Logo />
          </div>

          {isVisible ? (
            // Бегущая строка с подсказками; по нажатию — инструкция целиком
            <button
              onClick={() => {
                telegramService.haptic('selection');
                setIsHelpOpen(true);
              }}
              aria-label="Как это работает"
              className="pointer-events-auto flex-1 min-w-0 h-12 rounded-full bg-zine-cardElevated shadow-zine overflow-hidden flex items-center cursor-pointer"
            >
              <span className="marquee-track text-sm2 font-semibold text-zine-ink">
                <span className="px-4">{TIPS_LINE}</span>
                <span className="px-4" aria-hidden="true">{TIPS_LINE}</span>
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenProfile}
              className="pointer-events-auto flex-1 min-w-0 h-12 px-4 rounded-full bg-zine-plum text-white text-sm2 font-bold flex items-center justify-center gap-2 shadow-zine cursor-pointer"
            >
              <EyeOff size={18} className="shrink-0" />
              <span className="truncate">Ты скрыт</span>
            </button>
          )}

          <button
            onClick={() => {
              telegramService.haptic('selection');
              const next = isDark ? 'light' : 'dark';
              telegramService.setTheme(next);
              setIsDark(next === 'dark');
            }}
            aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            className="pointer-events-auto shrink-0 w-12 h-12 rounded-full bg-zine-cardElevated shadow-zine text-zine-ink flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          >
            {isDark ? <Sun size={24} /> : <Moon size={22} />}
          </button>
        </div>
        <div className="pointer-events-auto">
          <GoalChips value={selectedGoal} onChange={onSelectGoal} floating />
        </div>
      </div>

      {/* Как это работает — для тех, кто здесь впервые */}
      {isHelpOpen && (
        <BottomSheet title="Как это работает" onClose={() => setIsHelpOpen(false)}>
          <div className="space-y-4">
            {HELP_STEPS.map((step) => (
              <div key={step.title} className="flex gap-3.5">
                <span className="w-12 h-12 shrink-0 rounded-zine-sm bg-zine-card flex items-center justify-center text-[24px]">{step.emoji}</span>
                <div>
                  <p className="text-body font-bold text-zine-ink">{step.title}</p>
                  <p className="text-sm2 text-zine-inkMuted mt-0.5">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsHelpOpen(false)}
              className="h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold cursor-pointer"
            >
              Понятно
            </button>
            <button
              onClick={() => {
                setIsHelpOpen(false);
                onOpenProfile();
              }}
              className="h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer"
            >
              Моя анкета
            </button>
          </div>
        </BottomSheet>
      )}

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

export default MapScreen;
