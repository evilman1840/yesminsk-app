import React, { useEffect, useState } from 'react';
import { Pencil, Eye, EyeOff, Sun, Moon, Loader2, X } from 'lucide-react';
import { ActivityGoal, UserProfile, AppEvent, isAvailableNow, formatTime, GoalFilter, matchesGoalFilter, PlaceItem, PlaceMood } from '../types';
import { MoodChips, MoodPicker } from '../components/places/MoodPicker';
import { PlaceSheet } from '../components/places/PlaceSheet';
import { telegramService } from '../services/telegram';
import { MinskMap } from '../components/map/MinskMap';
import { BottomSheet } from '../components/ui/BottomSheet';
import { GoalChips } from '../components/ui/GoalChips';
import { Logo } from '../components/ui/Logo';
import { EventDetails } from '../components/common/EventDetails';
import { DonateSheet } from '../components/common/DonateSheet';

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
    availableUntil?: string | null;
  } | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile | null) => void;
  selectedGoal: GoalFilter;
  onSelectGoal: (goal: GoalFilter) => void;
  onOpenProfile: () => void;
  onToggleJoinEvent: (event: AppEvent) => Promise<boolean>;
  onUpdateLocation?: (coords: [number, number]) => void;
  onSetAvailable: (hours: number) => Promise<void>;
  onOpenNews: () => void;
  fewPeople?: boolean; // рядом меньше 3 человек — предлагаем позвать друзей
  places: PlaceItem[];
  mapMode: MapMode;
  onChangeMapMode: (mode: MapMode) => void;
  onOpenEvents: () => void;
  onCreateEventAtPlace: (place: PlaceItem) => void;
  initialPlaceId?: string | null;
}

// Подсказки для новичков: коротко — в бегущей строке, подробно — в шторке «Как это работает»
const TIPS_LINE =
  '👋 Впервые здесь? Нажми, чтобы узнать, как всё устроено  ·  Нажми на фото на карте — откроется анкета  ·  «Пообщаться» — передай привет  ·  «Сходки» — найди компанию или собери свою  ·  Заполни анкету во вкладке «Я»';

const HELP_STEPS = [
  { emoji: '🗺', title: 'Люди и сходки рядом', text: 'На карте видно, кто рядом и какие встречи скоро. Нажми на фото — откроется анкета.' },
  { emoji: '👋', title: '«Пообщаться»', text: 'Передай человеку привет. Если он ответит тем же, вы сможете написать друг другу в Telegram.' },
  { emoji: '⚡', title: '«Хочу сейчас»', text: 'Включи переключатель, если можешь встретиться в ближайшие 3 часа — твою анкету покажут в начале списка.' },
  { emoji: '🧭', title: '«Покажут город»', text: 'Ты турист? Местные жители с радостью покажут Минск. А если ты местный — включи «Покажу город» в анкете.' },
  { emoji: '📍', title: '«Места»', text: 'Переключи карту на «Места» и выбери настроение — Миша подскажет, куда сходить. Оставляй свои советы!' },
  { emoji: '🗓', title: 'Сходки', text: 'Присоединяйся к прогулкам и встречам или собери свою компанию — это займёт минуту.' },
  { emoji: '✏️', title: 'Твоя анкета', text: 'Во вкладке «Я» добавь фото и пару слов о себе — так тебя быстрее заметят.' },
  { emoji: '🛡', title: 'Безопасно', text: 'Твоя метка на карте смещена на 300–500 м. Можно включить режим невидимки.' }
];

export type MapMode = 'all' | 'people' | 'events' | 'places';

const MAP_TABS: [MapMode, string, string][] = [
  ['all', '🗺', 'Всё'],
  ['people', '👥', 'Люди'],
  ['events', '🗓', 'Сходки'],
  ['places', '📍', 'Места']
];

// Сходки по времени: всё / сегодня / завтра / ближайшие выходные
type EventWhen = 'all' | 'today' | 'tomorrow' | 'weekend';
const EVENT_WHEN: [EventWhen, string][] = [
  ['all', 'Все'],
  ['today', 'Сегодня'],
  ['tomorrow', 'Завтра'],
  ['weekend', 'Выходные']
];

const matchesWhen = (iso: string, when: EventWhen) => {
  if (when === 'all') return true;
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((d.getTime() - start.getTime()) / 86400000);
  if (when === 'today') return dayDiff === 0;
  if (when === 'tomorrow') return dayDiff === 1;
  // Ближайшие суббота и воскресенье (если сегодня выходной — эти же)
  const dow = start.getDay(); // 0 — воскресенье, 6 — суббота
  const toSat = dow === 0 ? -1 : 6 - dow;
  return dayDiff >= toSat && dayDiff <= toSat + 1 && dayDiff >= 0;
};

// На сколько часов включается «⚡ Хочу сейчас»
const AVAILABLE_HOURS = 3;

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
  onUpdateLocation,
  onSetAvailable,
  onOpenNews,
  fewPeople = false,
  places,
  mapMode,
  onChangeMapMode,
  onCreateEventAtPlace,
  initialPlaceId,
  onOpenEvents
}) => {
  // Сходки на карте: фильтр по времени
  const [eventWhen, setEventWhen] = useState<EventWhen>('all');
  const filteredEvents = events.filter((e) => matchesWhen(e.dateTime, eventWhen));
  // Места по вайбу
  const [mood, setMood] = useState<PlaceMood | 'all'>('all');
  const [isMoodPickerOpen, setIsMoodPickerOpen] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
  const isPlaces = mapMode === 'places';
  // Во вкладке «Всё» нет строки фильтров — подсказки поднимаем выше
  const overlayTop = mapMode === 'all' ? 'top-[132px]' : 'top-[188px]';
  const filteredPlaces = mood === 'all' ? places : places.filter((p) => p.moods.includes(mood));
  const moodCounts = places.reduce<Partial<Record<PlaceMood, number>>>((acc, p) => {
    p.moods.forEach((m) => (acc[m] = (acc[m] || 0) + 1));
    return acc;
  }, {});

  // Открыли приложение по ссылке на место
  useEffect(() => {
    if (!initialPlaceId) return;
    const found = places.find((p) => p.id === initialPlaceId);
    if (found) {
      setIsMoodPickerOpen(false);
      setSelectedPlace(found);
    }
  }, [initialPlaceId, places]);
  const [isFewHintClosed, setIsFewHintClosed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [isMySheetOpen, setIsMySheetOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const iAmAvailable = isAvailableNow(currentUser);

  const changeAvailability = async (hours: number) => {
    setIsSavingAvailability(true);
    try {
      await onSetAvailable(hours);
    } catch (err: any) {
      alert(err.message || 'Не удалось изменить статус');
    } finally {
      setIsSavingAvailability(false);
    }
  };
  const [isDark, setIsDark] = useState(() => telegramService.isDarkTheme());

  const filteredUsers = users.filter((u) => matchesGoalFilter(u, selectedGoal));
  const isVisible = currentUser?.isProfileActive !== false;

  return (
    <div className="relative h-full w-full overflow-hidden bg-zine-paper">
      <MinskMap
        users={mapMode === 'people' ? filteredUsers : mapMode === 'all' ? users : []}
        events={mapMode === 'events' ? filteredEvents : mapMode === 'all' ? events : []}
        places={isPlaces ? filteredPlaces : mapMode === 'all' ? places : []}
        onSelectPlace={(p) => {
          setIsMoodPickerOpen(false);
          setSelectedPlace(p);
        }}
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
        {/* Одна панель: маленький логотип │ бегущая строка */}
        <div className="px-4">
          <div className="pointer-events-auto h-12 flex items-center rounded-full bg-zine-cardElevated shadow-zine overflow-hidden">
            <div className="shrink-0 pl-4 pr-3 flex items-center">
              <Logo size="sm" />
            </div>
            <span className="shrink-0 w-px h-6 bg-zine-border" />

            {isVisible ? (
              // Подсказки для новичков; по нажатию — инструкция целиком
              <button
                onClick={() => {
                  telegramService.haptic('selection');
                  setIsHelpOpen(true);
                }}
                aria-label="Как это работает"
                className="flex-1 min-w-0 h-full overflow-hidden flex items-center cursor-pointer"
              >
                <span className="marquee-track text-sm2 font-semibold text-zine-ink">
                  <span className="px-3">{TIPS_LINE}</span>
                  <span className="px-3" aria-hidden="true">{TIPS_LINE}</span>
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenProfile}
                className="flex-1 min-w-0 h-full px-3 text-zine-plum text-sm2 font-bold flex items-center gap-2 cursor-pointer"
              >
                <EyeOff size={18} className="shrink-0" />
                <span className="truncate">Тебя не видно · включить</span>
              </button>
            )}

          </div>
        </div>
        {/* Три вкладки карты: Люди / Сходки / Места */}
        <div className="pointer-events-auto px-4">
          <div className="h-11 p-1 rounded-full bg-zine-cardElevated shadow-zine grid grid-cols-[0.8fr_1fr_1.15fr_1fr]">
            {MAP_TABS.map(([id, emoji, label]) => (
              <button
                key={id}
                onClick={() => {
                  if (mapMode === id) return;
                  telegramService.haptic('selection');
                  onSelectUser(null);
                  setSelectedEvent(null);
                  onChangeMapMode(id);
                }}
                className={`h-9 rounded-full text-sm2 font-bold flex items-center justify-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                  mapMode === id ? 'bg-zine-terracotta text-white' : 'text-zine-ink'
                }`}
              >
                <span className="text-[15px] leading-none">{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Фильтры выбранной вкладки */}
        <div className="pointer-events-auto">
          {mapMode === 'people' && <GoalChips value={selectedGoal} onChange={onSelectGoal} floating />}
          {mapMode === 'events' && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
              {EVENT_WHEN.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    telegramService.haptic('selection');
                    setEventWhen(id);
                  }}
                  className={`h-11 px-4 shrink-0 rounded-full text-sm2 font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                    eventWhen === id ? 'bg-zine-ink text-zine-paper border-zine-ink' : 'bg-zine-cardElevated text-zine-ink border-zine-border shadow-zine'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {isPlaces && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
              <MoodChips
                value={mood}
                onChange={(m) => {
                  setMood(m);
                  setIsMoodPickerOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Места: «С каким настроением ты сегодня?» или заглушка, пока мест нет */}
      {isPlaces && (places.length === 0 || isMoodPickerOpen) && (
        <div className={`absolute left-4 right-4 ${overlayTop} z-30`}>
          {places.length === 0 ? (
            <div className="p-4 rounded-zine bg-zine-cardElevated shadow-zine-float">
              <p className="font-serif font-bold text-title text-zine-ink">📍 Места по вайбу</p>
              <p className="mt-1 text-body text-zine-inkMuted">
                Скоро здесь появятся любимые места Миши — под любое настроение: разогнать тоску, сбежать от всех, накормить душу…
              </p>
            </div>
          ) : (
            <MoodPicker
              counts={moodCounts}
              onPick={(m) => {
                setMood(m);
                setIsMoodPickerOpen(false);
              }}
              onClose={() => setIsMoodPickerOpen(false)}
            />
          )}
        </div>
      )}

      {/* Сходок по выбранному времени нет */}
      {mapMode === 'events' && filteredEvents.length === 0 && (
        <div className={`absolute left-4 right-[72px] ${overlayTop} z-20 p-4 rounded-zine bg-zine-cardElevated shadow-zine-float`}>
          <p className="text-body font-bold text-zine-ink">{events.length === 0 ? 'Сходок пока нет' : 'На это время сходок нет'}</p>
          <p className="mt-1 text-sm2 text-zine-inkMuted">Собери свою — это займёт минуту, а люди рядом увидят её на карте.</p>
          <button onClick={onOpenEvents} className="mt-3 w-full h-11 rounded-zine-sm bg-zine-terracotta text-white text-sm2 font-bold cursor-pointer">
            Создать сходку
          </button>
        </div>
      )}

      {selectedPlace && (
        <PlaceSheet
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onCreateEvent={(p) => {
            setSelectedPlace(null);
            onCreateEventAtPlace(p);
          }}
        />
      )}

      {(mapMode === 'people' || mapMode === 'all') && fewPeople && !isFewHintClosed && (
        <div className={`absolute left-4 right-[72px] ${overlayTop} z-20 p-3.5 rounded-zine bg-zine-cardElevated shadow-zine-float`}>
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm2 text-zine-ink">
              <b>Рядом пока мало людей.</b> Позови друзей — вместе веселее 💛
            </p>
            <button onClick={() => setIsFewHintClosed(true)} aria-label="Скрыть" className="w-8 h-8 -mt-1 -mr-1 rounded-full flex items-center justify-center text-zine-inkMuted cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <button
            onClick={() => {
              telegramService.haptic('selection');
              telegramService.shareApp();
            }}
            className="mt-2 w-full h-11 rounded-zine-sm bg-zine-terracotta text-white text-sm2 font-bold cursor-pointer"
          >
            💌 Позвать друзей
          </button>
        </div>
      )}

      {/* Светлая / тёмная тема — небольшая кнопка у края карты, под фильтрами */}
      <button
        onClick={() => {
          telegramService.haptic('selection');
          const next = isDark ? 'light' : 'dark';
          telegramService.setTheme(next);
          setIsDark(next === 'dark');
        }}
        aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
        className={`absolute right-4 ${overlayTop} z-20 w-11 h-11 rounded-full bg-zine-cardElevated shadow-zine text-zine-ink flex items-center justify-center active:scale-90 transition-transform cursor-pointer`}
      >
        {isDark ? <Sun size={20} /> : <Moon size={18} />}
      </button>

      {/* Донат — заметная кнопка над «Где я?» */}
      <button
        onClick={() => {
          telegramService.haptic('selection');
          setIsDonateOpen(true);
        }}
        aria-label="Поддержать проект"
        className="absolute right-4 bottom-[128px] z-20 w-14 h-14 rounded-full bg-zine-terracotta text-white shadow-zine-float flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
      >
        <span className="absolute inset-0 rounded-full bg-zine-terracotta/40 animate-ping [animation-duration:2.5s]" />
        <span className="relative text-[26px] leading-none">💛</span>
      </button>
      {isDonateOpen && (
        <DonateSheet
          onClose={() => setIsDonateOpen(false)}
          onOpenNews={() => {
            setIsDonateOpen(false);
            onOpenNews();
          }}
        />
      )}

      {/* «⚡ Хочу сейчас» — переключатель: включает статус на 3 часа или выключает */}
      {(mapMode === 'people' || mapMode === 'all') && <button
        onClick={() => {
          telegramService.haptic('selection');
          if (!isVisible && !iAmAvailable) {
            setIsAvailabilityOpen(true); // в режиме невидимки сначала объясняем
            return;
          }
          if (!isSavingAvailability) changeAvailability(iAmAvailable ? 0 : AVAILABLE_HOURS);
        }}
        role="switch"
        aria-checked={iAmAvailable}
        aria-label="Хочу сейчас"
        className="absolute left-4 bottom-14 z-20 h-14 pl-4 pr-2.5 rounded-zine bg-zine-cardElevated text-zine-ink shadow-zine-float flex items-center gap-2.5 active:scale-95 transition-transform cursor-pointer"
      >
        <span className="text-[22px] leading-none">⚡</span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-body font-bold">Хочу сейчас</span>
          {iAmAvailable && <span className="text-cap font-semibold text-[#2FA36B]">до {formatTime(currentUser?.availableUntil)}</span>}
        </span>
        <span className={`ml-1 w-12 h-7 rounded-full p-[3px] transition-colors ${iAmAvailable ? 'bg-[#2FA36B]' : 'bg-zine-border'}`}>
          <span
            className={`flex items-center justify-center w-[22px] h-[22px] rounded-full bg-white shadow transition-transform ${
              iAmAvailable ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {isSavingAvailability && <Loader2 size={14} className="animate-spin text-zine-inkMuted" />}
          </span>
        </span>
      </button>}

      {/* В режиме невидимки статус бесполезен — подсказываем, что сделать */}
      {isAvailabilityOpen && (
        <BottomSheet title="Сейчас тебя не видно" onClose={() => setIsAvailabilityOpen(false)}>
          <p className="text-body text-zine-inkMuted">
            Включён режим невидимки, поэтому никто не увидит «Хочу сейчас». Выключи невидимку в анкете — и включи переключатель снова.
          </p>
          <button
            onClick={() => {
              setIsAvailabilityOpen(false);
              onOpenProfile();
            }}
            className="mt-5 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer"
          >
            Открыть анкету
          </button>
        </BottomSheet>
      )}

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
            onToggleJoin={async () => {
              if (!(await onToggleJoinEvent(selectedEvent))) return;
              setSelectedEvent({
                ...selectedEvent,
                isJoined: !selectedEvent.isJoined,
                participantsCount: (selectedEvent.participantsCount || 1) + (selectedEvent.isJoined ? -1 : 1)
              });
            }}
          />
        </BottomSheet>
      )}
    </div>
  );
};

export default MapScreen;
