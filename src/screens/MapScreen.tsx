import React, { useEffect, useRef, useState } from 'react';
import { thumb } from '../utils/thumb';
import { api } from '../services/api';
import { Pencil, Eye, EyeOff, Loader2, X, Layers, Users, CalendarDays, MapPin, Newspaper, Map as MapIcon, List } from 'lucide-react';
import { ActivityGoal, UserProfile, AppEvent, JoinOptions, placesForKids, EventWhen, EVENT_WHEN, matchesWhen, isAvailableNow, GoalFilter, matchesGoalFilter, PlaceItem, PlaceMood } from '../types';
import { MoodChips, MoodPicker, MoodFilter } from '../components/places/MoodPicker';
import { PlaceSheet } from '../components/places/PlaceSheet';
import { PlaceTypeFilter } from '../components/places/PlaceTypeFilter';
import { telegramService } from '../services/telegram';
import { MinskMap } from '../components/map/MinskMap';
import { BottomSheet } from '../components/ui/BottomSheet';
import { GoalChips } from '../components/ui/GoalChips';
import { SlidersHorizontal } from 'lucide-react';
import { PeopleFiltersSheet, PeopleFilters, MyPrefs, loadFilters, saveFilters, applyPeopleFilters, countActiveFilters } from '../components/people/PeopleFilters';
import { Logo } from '../components/ui/Logo';
import { EventDetails } from '../components/common/EventDetails';
import { DonateSheet } from '../components/common/DonateSheet';
import { WantNowButton } from '../components/common/WantNowButton';
import { DonateIcon } from '../components/ui/DonateIcon';
import { MapEventsList } from '../components/map/MapEventsList';
import { MAP_EVENTS_TEXTS } from '../texts/meetups';

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
    shownCoordinates?: [number, number] | null;
    locationManual?: boolean;
  } | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile | null) => void;
  selectedGoal: GoalFilter;
  onSelectGoal: (goal: GoalFilter) => void;
  onOpenProfile: () => void;
  onJoinEvent: (event: AppEvent, options: JoinOptions | null) => Promise<AppEvent | null>;
  onUpdateLocation?: (coords: [number, number]) => void;
  onSetShownLocation?: (coords: [number, number] | null) => Promise<void>; // своя метка; null — случайное смещение
  myPrefs?: MyPrefs; // «С кем комфортно» и «Возраст компании» из анкеты
  onSetAvailable: (hours: number) => Promise<void>;
  onOpenNews: () => void;
  unreadNews?: number;
  fewPeople?: boolean; // рядом меньше 3 человек — предлагаем позвать друзей
  places: PlaceItem[];
  mapMode: MapMode;
  onChangeMapMode: (mode: MapMode) => void;
  onOpenEvents: () => void;
  onOpenPeople: () => void;
  onCreateEventAtPlace: (place: PlaceItem) => void;
  onToggleSavePlace: (place: PlaceItem) => Promise<PlaceItem>;
  initialPlaceId?: string | null;
}

export type MapMode = 'all' | 'people' | 'events' | 'places';

const MAP_TABS: [MapMode, React.FC<any>, string][] = [
  ['all', Layers, 'Всё'],
  ['people', Users, 'Люди'],
  ['events', CalendarDays, 'Сходки'],
  ['places', MapPin, 'Места']
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
  onOpenPeople,
  events,
  currentUser,
  selectedUser,
  onSelectUser,
  selectedGoal,
  onSelectGoal,
  onOpenProfile,
  onJoinEvent,
  onUpdateLocation,
  onSetShownLocation,
  myPrefs = {},
  onSetAvailable,
  onOpenNews,
  unreadNews = 0,
  fewPeople = false,
  places,
  mapMode,
  onChangeMapMode,
  onCreateEventAtPlace,
  initialPlaceId,
  onOpenEvents,
  onToggleSavePlace,
}) => {
  // Сходки на карте: только предстоящие (как в ленте «Сходки» — начавшиеся больше получаса назад не показываем) и фильтр по времени
  const [eventWhen, setEventWhen] = useState<EventWhen>('all');
  const upcomingEvents = events.filter((e) => new Date(e.dateTime).getTime() > Date.now() - 30 * 60 * 1000);
  const filteredEvents = upcomingEvents.filter((e) => matchesWhen(e.dateTime, eventWhen));
  // Сходки кружками на карте или списком — что человек выбрал в прошлый раз
  const [eventsView, setEventsView] = useState<'map' | 'list'>(() => {
    try {
      return localStorage.getItem('yesminsk_map_events_view') === 'list' ? 'list' : 'map';
    } catch {
      return 'map';
    }
  });
  const changeEventsView = (view: 'map' | 'list') => {
    telegramService.haptic('selection');
    setEventsView(view);
    try {
      localStorage.setItem('yesminsk_map_events_view', view);
    } catch {
      // не запомним — в следующий раз снова карта
    }
  };
  const isEventsList = mapMode === 'events' && eventsView === 'list';
  const noEventsCard = (
    <div className="p-4 rounded-zine bg-zine-cardElevated shadow-zine-float">
      <p className="text-body font-bold text-zine-ink">{upcomingEvents.length === 0 ? 'Сходок пока нет' : 'На это время сходок нет'}</p>
      <p className="mt-1 text-sm2 text-zine-inkMuted">Собери свою, это займёт минуту, а люди рядом увидят её на карте.</p>
      <button onClick={onOpenEvents} className="mt-3 w-full h-11 rounded-zine-sm bg-zine-terracotta text-white text-sm2 font-bold cursor-pointer">
        Создать сходку
      </button>
    </div>
  );
  // Места по вайбу
  const [mood, setMood] = useState<MoodFilter>('all');
  const [placeType, setPlaceType] = useState<string | null>(null);
  const [isMoodPickerOpen, setIsMoodPickerOpen] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
  const isPlaces = mapMode === 'places';
  // Подсказки и списки — под шапкой и строкой фильтров вкладки
  const overlayTop = 'top-[196px]';
  const filteredPlaces = (
    mood === 'all'
      ? places
      : mood === 'saved'
      ? places.filter((p) => p.isSaved)
      : mood === 'kids'
      ? placesForKids(places)
      : places.filter((p) => p.moods.includes(mood))
  ).filter((p) => !placeType || p.category === placeType);
  const kidsCount = places.filter((p) => p.kidsLevel).length;
  const savedCount = places.filter((p) => p.isSaved).length;
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
  // «Сдвинуть метку»: человек сам выбирает, где его видят на карте
  const [isPicking, setIsPicking] = useState(false);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const getMapCenter = useRef<() => [number, number] | null>(() => null);
  const savePick = async (reset = false) => {
    if (!onSetShownLocation || pickBusy) return;
    const c = reset ? null : getMapCenter.current();
    if (!reset && !c) return;
    setPickBusy(true);
    setPickError(null);
    try {
      await onSetShownLocation(c);
      telegramService.haptic('success');
      setIsPicking(false);
    } catch (err: any) {
      telegramService.haptic('error');
      setPickError(err?.message || 'Не получилось сохранить метку');
    } finally {
      setPickBusy(false);
    }
  };
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  // Фильтры людей — общие с «Людьми» (хранятся на устройстве); по умолчанию учитывают мои настройки из анкеты
  const [peopleFilters, setPeopleFilters] = useState<PeopleFilters>(loadFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  useEffect(() => saveFilters(peopleFilters), [peopleFilters]);
  const activeFilters = countActiveFilters(peopleFilters);
  const usersForMe = applyPeopleFilters(users, peopleFilters, myPrefs);
  const filteredUsers = usersForMe.filter((u) => matchesGoalFilter(u, selectedGoal));
  // Сколько всего анкет: на карте только самые активные, а в шапке — все
  // В шапке — сколько всего людей в приложении (видно, что тут живое сообщество)
  const [totalPeople, setTotalPeople] = useState(0);
  useEffect(() => {
    api
      .getNearbyCount()
      .then((r) => setTotalPeople(r.all || r.total))
      .catch(() => {});
  }, [users.length]);
  const peopleCount = Math.max(totalPeople, users.length);

  // Для шапки: «⚡ могут сейчас» — первыми, лица с фото
  const freeNowCount = users.filter((u) => isAvailableNow(u)).length;
  const nearbyFaces = [...users]
    .filter((u) => u.avatarUrl)
    .sort((a, b) => Number(isAvailableNow(b)) - Number(isAvailableNow(a)))
    .slice(0, 3);
  const isVisible = currentUser?.isProfileActive !== false;

  return (
    <div className="relative h-full w-full overflow-hidden bg-zine-paper">
      <MinskMap
        users={mapMode === 'people' ? filteredUsers : mapMode === 'all' ? usersForMe : []}
        events={mapMode === 'events' ? filteredEvents : mapMode === 'all' ? upcomingEvents : []}
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
        shownCoords={currentUser?.shownCoordinates}
        picking={isPicking}
        onPickCenter={(fn) => (getMapCenter.current = fn)}
        pickHint={
          <div className="absolute inset-x-4 bottom-4 z-30 p-4 rounded-zine bg-zine-cardElevated shadow-zine-float">
            <p className="text-body font-bold text-zine-ink">📍 Двигай карту</p>
            <p className="mt-1 text-sm2 text-zine-inkMuted">Поставь метку там, где тебе спокойно: другие увидят тебя в этой точке. Твой адрес никто не узнает.</p>
            {pickError && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{pickError}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setIsPicking(false)} className="h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold cursor-pointer">
                Отмена
              </button>
              <button onClick={() => savePick()} disabled={pickBusy} className="h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold flex items-center justify-center cursor-pointer">
                {pickBusy ? <Loader2 size={20} className="animate-spin" /> : 'Сохранить'}
              </button>
            </div>
            {currentUser?.locationManual && (
              <button onClick={() => savePick(true)} disabled={pickBusy} className="mt-2 w-full h-10 text-sm2 font-semibold text-zine-inkMuted cursor-pointer">
                Вернуть случайное смещение
              </button>
            )}
          </div>
        }
      />

      {/* Шапка на однотонном фоне, как в «Людях», «Сходках» и «Местах»: логотип, кто с нами, новости и донат; под ней вкладки карты */}
      <div className="absolute top-0 inset-x-0 z-20 space-y-2 pointer-events-none">
        <div className="pointer-events-auto px-3 pt-3 pb-2.5 bg-zine-paper border-b border-zine-border space-y-2.5">
          <div className="h-11 flex items-center gap-2">
            <Logo size="sm" className="pl-1" />
            {isVisible ? (
              users.length > 0 ? (
                // Кто с нами: лица и сколько их — сразу видно, что тут живые люди
                <button
                  onClick={() => {
                    telegramService.haptic('selection');
                    onOpenPeople();
                  }}
                  className="flex-1 min-w-0 h-11 pl-1 pr-1 rounded-full flex items-center gap-2 active:bg-zine-card cursor-pointer"
                >
                  <span className="flex shrink-0 pl-2">
                    {nearbyFaces.map((u) => (
                      <img key={u.id} src={thumb(u.avatarUrl)} alt="" className="-ml-2 w-7 h-7 rounded-full object-cover border-2 border-zine-paper bg-zine-card" />
                    ))}
                  </span>
                  <span className="min-w-0 text-left leading-tight">
                    <span className="block text-cap font-bold text-zine-ink whitespace-nowrap">{peopleCount.toLocaleString('ru-RU')} с нами</span>
                    <span className="block text-[11px] text-zine-inkMuted whitespace-nowrap truncate">
                      {freeNowCount > 0 ? `⚡ ${freeNowCount} ${freeNowCount === 1 ? 'может' : 'могут'} сейчас` : 'загляни к ним'}
                    </span>
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => telegramService.shareApp()}
                  className="flex-1 min-w-0 h-11 px-2 text-left font-hand font-semibold text-[18px] leading-none text-zine-inkMuted cursor-pointer"
                >
                  позови друзей →
                </button>
              )
            ) : (
              <button
                onClick={onOpenProfile}
                className="flex-1 min-w-0 h-10 px-3 rounded-full bg-zine-plum/10 text-zine-plum text-cap font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <EyeOff size={16} className="shrink-0" />
                <span className="truncate">Тебя не видно · включить</span>
              </button>
            )}

            {/* Новости проекта — со счётчиком новых */}
            <button
              onClick={() => {
                telegramService.haptic('selection');
                onOpenNews();
              }}
              aria-label="Новости проекта"
              className="relative w-11 h-11 shrink-0 rounded-full bg-zine-card text-zine-ink flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            >
              <Newspaper size={21} />
              {unreadNews > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-zine-terracotta text-white text-[11px] font-bold flex items-center justify-center border-2 border-zine-paper">
                  {unreadNews}
                </span>
              )}
            </button>

            {/* Донат: сердце со знаком рубля — видно, что это про поддержку деньгами */}
            <button
              onClick={() => {
                telegramService.haptic('selection');
                setIsDonateOpen(true);
              }}
              aria-label="Поддержать проект"
              className="w-11 h-11 shrink-0 rounded-full bg-zine-terracotta text-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            >
              <DonateIcon size={26} cutout="rgb(var(--c-terracotta))" />
            </button>
          </div>

          {/* Вкладки карты: Всё / Люди / Сходки / Места; у «Всё» и «Люди» рядом фильтры людей */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 p-1 rounded-[18px] bg-zine-card grid grid-cols-4 gap-1">
              {MAP_TABS.map(([id, Icon, label]) => {
                const isActive = mapMode === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (isActive) return;
                      telegramService.haptic('selection');
                      onSelectUser(null);
                      setSelectedEvent(null);
                      onChangeMapMode(id);
                    }}
                    aria-pressed={isActive}
                    className={`h-12 rounded-[14px] flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      isActive ? 'bg-zine-terracotta text-white shadow-zine-sm' : 'text-zine-inkMuted active:bg-zine-cardElevated'
                    }`}
                  >
                    <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                    <span className={`text-cap ${isActive ? 'font-bold' : 'font-semibold'}`}>{label}</span>
                  </button>
                );
              })}
            </div>
            {(mapMode === 'people' || mapMode === 'all') && (
              <button
                onClick={() => {
                  telegramService.haptic('selection');
                  setIsFiltersOpen(true);
                }}
                aria-label={activeFilters > 0 ? `Фильтры: ${activeFilters}` : 'Фильтры'}
                className={`relative w-14 shrink-0 rounded-[18px] flex items-center justify-center transition-colors cursor-pointer ${
                  activeFilters > 0 ? 'bg-zine-ink text-zine-paper' : 'bg-zine-card text-zine-ink'
                }`}
              >
                <SlidersHorizontal size={21} />
                {activeFilters > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-zine-terracotta text-white text-[11px] font-bold flex items-center justify-center border-2 border-zine-paper">
                    {activeFilters}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Фильтры выбранной вкладки */}
        <div className="pointer-events-auto">
          {mapMode === 'people' && <GoalChips value={selectedGoal} onChange={onSelectGoal} floating />}
          {mapMode === 'events' && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
              {/* Как показать: кружками на карте или списком */}
              <div className="h-11 p-1 shrink-0 rounded-full bg-zine-cardElevated border border-zine-border shadow-zine flex" role="group" aria-label="Как показать сходки">
                {([
                  ['map', MapIcon, MAP_EVENTS_TEXTS.onMap],
                  ['list', List, MAP_EVENTS_TEXTS.asList]
                ] as const).map(([view, Icon, label]) => (
                  <button
                    key={view}
                    onClick={() => eventsView !== view && changeEventsView(view)}
                    aria-pressed={eventsView === view}
                    className={`h-full px-3 rounded-full text-sm2 font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                      eventsView === view ? 'bg-zine-terracotta text-white' : 'text-zine-inkMuted'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
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
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4">
              <PlaceTypeFilter places={places} value={placeType} onChange={setPlaceType} variant="light" />
              <MoodChips
                savedCount={savedCount}
                kidsCount={kidsCount}
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
                Скоро здесь появятся самые классные и вайбовые места города под любое настроение: разогнать тоску, сбежать от всех, накормить душу…
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
      {mapMode === 'events' && filteredEvents.length === 0 && !isEventsList && (
        <div className={`absolute left-4 right-[72px] ${overlayTop} z-20`}>{noEventsCard}</div>
      )}

      {/* Сходки списком вместо кружочков */}
      {isEventsList && <MapEventsList events={filteredEvents} topClass="top-[192px]" onOpen={(ev) => setSelectedEvent(ev)} empty={noEventsCard} />}

      {selectedPlace && (
        <PlaceSheet
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onCreateEvent={(p) => {
            setSelectedPlace(null);
            onCreateEventAtPlace(p);
          }}
          onToggleSave={async (p) => setSelectedPlace(await onToggleSavePlace(p))}
          events={events}
          onJoinEvent={onJoinEvent}
        />
      )}

      {(mapMode === 'people' || mapMode === 'all') && fewPeople && !isFewHintClosed && (
        <div className={`absolute left-4 right-[72px] ${overlayTop} z-20 p-3.5 rounded-zine bg-zine-cardElevated shadow-zine-float`}>
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm2 text-zine-ink">
              <b>Рядом пока мало людей.</b> Позови друзей, вместе веселее 💛
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

      {isDonateOpen && (
        <DonateSheet
          onClose={() => setIsDonateOpen(false)}
          onOpenNews={() => {
            setIsDonateOpen(false);
            onOpenNews();
          }}
        />
      )}

      {/* «⚡ Хочу сейчас» — круглая кнопка над «Где я?»: сначала объясняет, потом включает */}
      {(mapMode === 'people' || mapMode === 'all') && (
        <div className="absolute right-4 bottom-[128px] z-20">
          <WantNowButton availableUntil={currentUser?.availableUntil} isVisible={isVisible} onSet={onSetAvailable} onOpenProfile={onOpenProfile} look="map" />
        </div>
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
            <span>
              {!isVisible
                ? 'Режим невидимки: другие тебя не видят.'
                : currentUser.locationManual
                ? 'Тебя видят на карте в выбранной тобой точке. Точный адрес скрыт.'
                : 'Тебя видят на карте. Точный адрес скрыт: метка смещена на 500-800 м.'}
            </span>
          </div>

          {isVisible && onSetShownLocation && (
            <button
              onClick={() => {
                setIsMySheetOpen(false);
                setPickError(null);
                setIsPicking(true);
              }}
              className="mt-2 w-full h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <MapPin size={20} className="text-zine-terracotta" />
              <span>Сдвинуть метку</span>
            </button>
          )}

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

      {isFiltersOpen && (
        <PeopleFiltersSheet
          value={peopleFilters}
          onChange={setPeopleFilters}
          resultCount={(mapMode === 'people' ? filteredUsers : usersForMe).length}
          onClose={() => setIsFiltersOpen(false)}
        />
      )}

      {/* Сходка на карте */}
      {selectedEvent && (
        <BottomSheet title={selectedEvent.title} onClose={() => setSelectedEvent(null)}>
          <EventDetails
            event={selectedEvent}
            onJoin={async (options) => {
              const updated = await onJoinEvent(selectedEvent, options);
              if (updated) setSelectedEvent(updated);
            }}
          />
        </BottomSheet>
      )}
    </div>
  );
};

export default MapScreen;
