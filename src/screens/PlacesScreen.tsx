import React, { useLayoutEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, CalendarPlus, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from 'lucide-react';
import { PlaceItem, PlaceMood, AppEvent, JoinOptions, PLACE_MOODS, PLACE_TYPES, placeTypeEmoji, placesForKids, KIDS_LEVELS } from '../types';
import { api, serverUrl } from '../services/api';
import { telegramService } from '../services/telegram';
import { MoodFilter } from '../components/places/MoodPicker';
import { PlaceSheet, eventsAtPlace, shortWhen } from '../components/places/PlaceSheet';
import { BottomSheet } from '../components/ui/BottomSheet';
import { FilterChip } from '../components/ui/FilterChip';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { UndoToast } from '../components/ui/UndoToast';
import { SuggestPlaceSheet } from '../components/common/SuggestPlaceSheet';
import { SUGGEST_TEXTS as SG } from '../texts/suggest';

// Места, смахнутые влево («Неинтересно»). На сервере тоже сохраняются —
// при следующем запуске сервер их уже не пришлёт
const notInterestedPlaces = new Set<string>();
export const forgetNotInterestedPlace = (id: string) => notInterestedPlaces.delete(id);

/**
 * «Места» как Reels: карточки листаются вверх-вниз; свайп вправо — сохранить, влево — неинтересно; тап — подробнее.
 * Сверху «Все / Сохранённые», настроение и тип места — в шторке фильтров
 */
export const PlacesScreen: React.FC<{
  places: PlaceItem[];
  onToggleSave: (place: PlaceItem) => Promise<PlaceItem>;
  onCreateEvent: (place: PlaceItem) => void;
  events?: AppEvent[];
  onJoinEvent?: (event: AppEvent, options: JoinOptions | null) => Promise<AppEvent | null>;
}> = ({ places, onToggleSave, onCreateEvent, events, onJoinEvent }) => {
  const [mood, setMood] = useState<MoodFilter>('all');
  const [placeType, setPlaceType] = useState<string | null>(null); // фильтр по типу: «Парк», «Музей»…
  const [openedPlace, setOpenedPlace] = useState<PlaceItem | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [, setHiddenVersion] = useState(0); // перерисовать после «Неинтересно»
  const [justHidden, setJustHidden] = useState<PlaceItem | null>(null);

  const savedCount = places.filter((p) => p.isSaved).length;
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null);
  const shown = (
    mood === 'all'
      ? places
      : mood === 'saved'
      ? places.filter((p) => p.isSaved)
      : mood === 'kids'
      ? placesForKids(places)
      : places.filter((p) => p.moods.includes(mood))
  ).filter(
    (p) => !notInterestedPlaces.has(p.id) && (!placeType || p.category === placeType)
  );
  // После «Вернуть» — сразу показываем возвращённую карточку
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!scrollToId) return;
    const index = shown.findIndex((item) => item.id === scrollToId);
    const list = listRef.current;
    if (list && index >= 0) list.scrollTo({ top: index * list.clientHeight });
    setScrollToId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToId]);

  const visiblePlaces = places.filter((p) => !notInterestedPlaces.has(p.id));
  const kidsCount = places.filter((p) => p.kidsLevel).length;
  const typeCounts = Object.keys(PLACE_TYPES)
    .map((t) => [t, visiblePlaces.filter((p) => p.category === t).length] as const)
    .filter(([, n]) => n > 0);
  const isSavedTab = mood === 'saved';
  const activeFilters = Number(mood !== 'all' && !isSavedTab) + Number(Boolean(placeType));
  // Выбранное в шторке — чипами под шапкой, крестик сбрасывает
  const activeChips = [
    mood !== 'all' && !isSavedTab && {
      key: 'mood',
      label: mood === 'kids' ? '👶 С детьми' : `${PLACE_MOODS[mood as PlaceMood].emoji} ${PLACE_MOODS[mood as PlaceMood].label}`,
      onClear: () => setMood('all')
    },
    placeType && { key: 'type', label: `${placeTypeEmoji(placeType)} ${placeType}`, onClear: () => setPlaceType(null) }
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[];

  return (
    <div className="h-full w-full bg-[#141210] flex flex-col overflow-hidden">
      {/* Шапка на однотонном фоне, чтобы фото было чистым. Название экрана уже есть в нижнем меню */}
      <div className="shrink-0 px-3 pt-3 pb-3 text-white">
        <div className="flex items-center gap-1.5">
          {/* Предложить своё место */}
          <button
            onClick={() => setIsSuggestOpen(true)}
            aria-label={SG.placesButton}
            className="w-11 h-11 shrink-0 rounded-full bg-zine-terracotta active:bg-zine-terracottaHover text-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>

          <div className="flex-1 min-w-0 flex p-[3px] rounded-full bg-white/10">
            {([
              ['all', 'Все'],
              ['saved', savedCount > 0 ? `🔖 Сохранённые · ${savedCount}` : '🔖 Сохранённые']
            ] as const).map(([id, label]) => {
              const isActive = id === 'saved' ? isSavedTab : !isSavedTab;
              return (
                <button
                  key={id}
                  onClick={() => {
                    telegramService.haptic('selection');
                    // «Сохранённые» — без настроения; «Все» — без «Сохранённых»
                    setMood(id === 'saved' ? 'saved' : isSavedTab ? 'all' : mood);
                  }}
                  className={`flex-auto min-w-0 h-[38px] px-2 rounded-full text-[14px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                    isActive ? 'bg-white text-[#2B2623]' : 'text-white/80'
                  }`}
                >
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              telegramService.haptic('selection');
              setIsFiltersOpen(true);
            }}
            aria-label={activeFilters > 0 ? `Фильтры: ${activeFilters}` : 'Фильтры'}
            className={`relative w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              activeFilters > 0 ? 'bg-white text-[#2B2623]' : 'bg-white/10 text-white'
            }`}
          >
            <SlidersHorizontal size={20} />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-zine-terracotta text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
            {activeChips.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  telegramService.haptic('selection');
                  c.onClear();
                }}
                className="h-9 pl-3 pr-2 shrink-0 rounded-full bg-white text-[#2B2623] text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="whitespace-nowrap">{c.label}</span>
                <X size={16} className="text-[#2B2623]/60" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
      {shown.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 text-white">
          <div className="text-[48px] mb-3">{mood === 'saved' ? '🔖' : '📍'}</div>
          <p className="font-serif font-bold text-title">{mood === 'saved' ? 'Пока ничего не сохранено' : places.length ? 'Под это настроение мест пока нет' : 'Места скоро появятся'}</p>
          <p className="mt-2 text-body text-white/70">
            {mood === 'saved'
              ? 'Нажимай 🔖 на местах, которые хочешь посетить, они соберутся здесь.'
              : 'Скоро здесь будут самые классные и вайбовые места города.'}
          </p>
          {mood !== 'saved' && (
            <button onClick={() => setIsSuggestOpen(true)} className="mt-5 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer">
              {SG.placesButton}
            </button>
          )}
        </div>
      ) : (
        <div ref={listRef} className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
          {shown.map((place, index) => (
            <PlaceReel
              key={place.id}
              place={place}
              isFirst={index === 0}
              onOpen={() => setOpenedPlace(place)}
              onToggleSave={onToggleSave}
              onCreateEvent={onCreateEvent}
              events={events}
              onNotInterested={() => {
                notInterestedPlaces.add(place.id);
                setHiddenVersion((v) => v + 1);
                setJustHidden(place);
                api.hidePlace(place.id).catch(() => {});
              }}
            />
          ))}
          {/* После последнего места: предложи своё */}
          <section className="relative h-full w-full snap-start snap-always flex flex-col items-center justify-center text-center px-8 text-white bg-gradient-to-b from-[#2B2623] to-[#141210]">
            <div className="text-[56px] mb-3">📍</div>
            <p className="font-serif font-bold text-title">{SG.placesCta}</p>
            <p className="mt-2 text-body text-white/75">{SG.placesCtaText}</p>
            <button onClick={() => setIsSuggestOpen(true)} className="mt-5 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-95 transition-transform">
              {SG.placesButton}
            </button>
            {suggested && <p className="mt-4 text-sm2 text-white/85">{SG.doneText(suggested)}</p>}
          </section>
        </div>
      )}

      {justHidden && (
        <UndoToast
          topClass="top-3"
          text={`Скрыто: ${justHidden.name}`}
          onDone={() => setJustHidden(null)}
          onUndo={() => {
            notInterestedPlaces.delete(justHidden.id);
            api.hidePlace(justHidden.id, false).catch(() => {});
            setScrollToId(justHidden.id);
            setJustHidden(null);
            setHiddenVersion((v) => v + 1);
          }}
        />
      )}
      </div>

      {isFiltersOpen && (
        <BottomSheet title="Фильтры" onClose={() => setIsFiltersOpen(false)}>
          <p className="mb-2.5 text-body font-bold text-zine-ink">Настроение</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'Любое', ''],
              ...(Object.keys(PLACE_MOODS) as PlaceMood[]).map((m) => [m, PLACE_MOODS[m].label, PLACE_MOODS[m].emoji]),
              ...(kidsCount > 0 ? [['kids', 'С детьми', '👶']] : [])
            ] as [MoodFilter, string, string][]).map(([id, label, emoji]) => (
              <FilterChip key={id} active={mood === id || (id === 'all' && isSavedTab)} onClick={() => setMood(id)}>
                {emoji && <span className="text-[18px] leading-none">{emoji}</span>}
                <span>{label}</span>
              </FilterChip>
            ))}
          </div>
          {typeCounts.length > 0 && (
            <>
              <p className="mt-5 mb-2.5 text-body font-bold text-zine-ink">Тип места</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!placeType} onClick={() => setPlaceType(null)}>Все типы</FilterChip>
                {typeCounts.map(([t, n]) => (
                  <FilterChip key={t} active={placeType === t} onClick={() => setPlaceType(t)}>
                    <span className="text-[18px] leading-none">{placeTypeEmoji(t)}</span>
                    <span>{t}</span>
                    <span className={placeType === t ? 'opacity-70' : 'text-zine-inkMuted'}>{n}</span>
                  </FilterChip>
                ))}
              </div>
            </>
          )}
          <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
            <button
              onClick={() => {
                if (!isSavedTab) setMood('all');
                setPlaceType(null);
              }}
              className="h-12 px-5 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold cursor-pointer"
            >
              Сбросить
            </button>
            <button onClick={() => setIsFiltersOpen(false)} className="h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
              {shown.length > 0 ? `Показать (${shown.length})` : 'Ничего не нашлось'}
            </button>
          </div>
        </BottomSheet>
      )}

      {isSuggestOpen && (
        <SuggestPlaceSheet
          onClose={() => setIsSuggestOpen(false)}
          onDone={(name) => {
            setIsSuggestOpen(false);
            setSuggested(name);
          }}
        />
      )}


      {openedPlace && (
        <PlaceSheet
          place={places.find((p) => p.id === openedPlace.id) || openedPlace}
          onClose={() => setOpenedPlace(null)}
          onCreateEvent={(p) => {
            setOpenedPlace(null);
            onCreateEvent(p);
          }}
          events={events}
          onJoinEvent={onJoinEvent}
          onToggleSave={async (p) => {
            setOpenedPlace(await onToggleSave(p));
          }}
        />
      )}
    </div>
  );
};

const PlaceReel: React.FC<{
  place: PlaceItem;
  isFirst: boolean;
  onOpen: () => void;
  onToggleSave: (place: PlaceItem) => Promise<PlaceItem>;
  onCreateEvent: (place: PlaceItem) => void;
  onNotInterested: () => void;
  events?: AppEvent[];
}> = ({ place, isFirst, onOpen, onToggleSave, onCreateEvent, onNotInterested, events = [] }) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const placeEvents = eventsAtPlace(place, events);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (isSaving) return;
    telegramService.haptic(place.isSaved ? 'light' : 'success');
    setIsSaving(true);
    try {
      await onToggleSave(place);
    } finally {
      setIsSaving(false);
    }
  };

  const commentsCount = place.tipsCount + (place.reviews?.length || 0);
  const showPhoto = (step: number) => {
    telegramService.haptic('selection');
    setPhotoIndex((i) => (i + step + place.photos.length) % place.photos.length);
  };

  return (
    <SwipeReel
      className="flex flex-col"
      rightLabel={place.isSaved ? undefined : '🔖 Сохранить'}
      rightBehavior="next"
      leftLabel={place.isSaved ? undefined : 'Неинтересно'}
      leftBehavior="remove"
      onSwipe={(dir) => (dir === 'right' ? save() : onNotInterested())}
    >
      {/* Фото — без надписей и кнопок поверх, только точки и стрелки. Тап по центру — карточка места */}
      <div className="relative mx-3 flex-1 min-h-[42%] rounded-zine overflow-hidden bg-gradient-to-br from-[#5B7B68] to-[#2B2623]">
        {place.photos.length > 0 ? (
          place.photos.map((photo, i) => (
            <img
              key={photo}
              src={serverUrl(photo)}
              alt={place.name}
              draggable={false}
              onClick={onOpen}
              className={`absolute inset-0 h-full w-full object-cover cursor-pointer transition-opacity duration-200 ${i === photoIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ))
        ) : (
          <div onClick={onOpen} className="absolute inset-0 flex items-center justify-center text-[88px] leading-none cursor-pointer select-none">
            {PLACE_MOODS[place.moods[0]]?.emoji || '📍'}
          </div>
        )}
        {/* Несколько фото: точки сверху, по бокам листать (как в сторис) */}
        {place.photos.length > 1 && (
          <>
            <div className="absolute top-2.5 inset-x-0 z-10 flex justify-center gap-1.5 pointer-events-none" aria-hidden>
              {place.photos.map((photo, i) => (
                <span key={photo} className={`w-1.5 h-1.5 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/45'}`} />
              ))}
            </div>
            <button type="button" aria-label="Предыдущее фото" onClick={() => showPhoto(-1)} className="absolute left-0 inset-y-0 w-[30%] z-10 flex items-center justify-start pl-2 cursor-pointer">
              <span className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white/90 flex items-center justify-center">
                <ChevronLeft size={22} />
              </span>
            </button>
            <button type="button" aria-label="Следующее фото" onClick={() => showPhoto(1)} className="absolute right-0 inset-y-0 w-[30%] z-10 flex items-center justify-end pr-2 cursor-pointer">
              <span className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white/90 flex items-center justify-center">
                <ChevronRight size={22} />
              </span>
            </button>
          </>
        )}
        {/* Подсказка про свайпы — только на первой карточке, внизу фото */}
        {isFirst && <SwipeHint className="bottom-3" left={place.isSaved ? undefined : 'неинтересно'} right={place.isSaved ? undefined : 'сохранить'} />}
      </div>

      {/* Текст на сплошном фоне; нажатие мимо кнопок — карточка места */}
      <div
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) onOpen();
        }}
        className="shrink-0 px-4 pt-3 text-white cursor-pointer"
      >
        {/* Одна строка: тип · рейтинг · с детьми · отзывы, затем вайбы места; не влезает — листается */}
        <div data-no-swipe className="-mx-4 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar fade-right text-sm2 font-semibold text-white/70 whitespace-nowrap">
          {[
            place.category ? `${placeTypeEmoji(place.category)} ${place.category}` : '',
            place.rating ? `★ ${place.rating.toFixed(1).replace('.', ',')}` : '',
            place.kidsLevel && KIDS_LEVELS[place.kidsLevel] ? `👶 ${KIDS_LEVELS[place.kidsLevel].tiny}` : '',
            commentsCount > 0 ? `💬 ${commentsCount}` : ''
          ]
            .filter(Boolean)
            .map((part, i) => (
              <span key={part} className={`shrink-0 ${part.startsWith('★') ? 'text-[#FFD36B]' : ''}`}>
                {i > 0 && <span className="mr-2 text-white/30">·</span>}
                {part}
              </span>
            ))}
          {place.moods.map((m) => (
            <span key={m} className="h-7 px-2.5 shrink-0 rounded-full border border-white/20 bg-white/10 text-cap font-semibold text-white flex items-center">
              {PLACE_MOODS[m].emoji} {PLACE_MOODS[m].label}
            </span>
          ))}
        </div>
        <h2 className="mt-1 flex items-center gap-1 font-serif font-bold text-title leading-tight">
          <span className="line-clamp-2">{place.name}</span>
          <ChevronRight size={22} className="shrink-0 text-white/60" aria-hidden />
        </h2>
        {/* Сюда собирается сходка — сами сходки в карточке места */}
        {placeEvents.length > 0 && (
          <p className="mt-1 text-sm2 font-semibold text-zine-mustard truncate">
            📅 {placeEvents.length > 1 ? `Сходки здесь: ${placeEvents.length} · ближайшая ` : 'Сходка здесь: '}
            {shortWhen(placeEvents[0].dateTime).toLowerCase()}
          </p>
        )}
        {place.description && <p className="mt-1.5 text-sm2 text-white/80 line-clamp-2">{place.description}</p>}
      </div>

      {/* Кнопки под большим пальцем */}
      <div className="shrink-0 px-4 pt-3 pb-3 flex gap-2 text-white">
        <button
          onClick={save}
          className={`shrink-0 h-12 px-3.5 rounded-full text-body font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform ${
            place.isSaved ? 'bg-zine-sage' : 'border border-white/25'
          }`}
        >
          {place.isSaved ? <BookmarkCheck size={20} className="shrink-0" /> : <Bookmark size={20} className="shrink-0" />}
          <span className="truncate">{place.isSaved ? 'Сохранено' : 'Сохранить'}</span>
        </button>
        <button
          onClick={() => onCreateEvent(place)}
          className="flex-1 min-w-0 h-12 px-2.5 rounded-full bg-zine-terracotta text-body font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <CalendarPlus size={20} className="shrink-0" />
          <span className="truncate">Сходка сюда</span>
        </button>
      </div>
    </SwipeReel>
  );
};

export default PlacesScreen;
