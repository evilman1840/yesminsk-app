import React, { useLayoutEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, CalendarPlus } from 'lucide-react';
import { PlaceItem, AppEvent, JoinOptions, PLACE_MOODS, placeTypeEmoji, placesForKids, KIDS_LEVELS } from '../types';
import { api, serverUrl } from '../services/api';
import { telegramService } from '../services/telegram';
import { MoodChips, MoodFilter } from '../components/places/MoodPicker';
import { PlaceSheet } from '../components/places/PlaceSheet';
import { PlaceTypeFilter } from '../components/places/PlaceTypeFilter';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { UndoToast } from '../components/ui/UndoToast';
import { ChevronRight } from 'lucide-react';

// Места, смахнутые влево («Неинтересно»). На сервере тоже сохраняются —
// при следующем запуске сервер их уже не пришлёт
const notInterestedPlaces = new Set<string>();
export const forgetNotInterestedPlace = (id: string) => notInterestedPlaces.delete(id);

/**
 * «Места» как Reels: полноэкранные карточки, листаются вверх-вниз; свайп вправо — сохранить, влево — неинтересно; тап — подробнее
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
  const [, setHiddenVersion] = useState(0); // перерисовать после «Неинтересно»
  const [justHidden, setJustHidden] = useState<PlaceItem | null>(null);

  const savedCount = places.filter((p) => p.isSaved).length;
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

  return (
    <div className="relative h-full w-full bg-[#141210] overflow-hidden">
      {/* Фильтр настроений поверх карточек */}
      <div className="absolute top-0 inset-x-0 z-20 pt-3 pb-6 bg-gradient-to-b from-black/60 to-transparent">
        <div className="px-4 mb-2 flex items-center justify-between gap-3">
          <h1 className="font-serif font-bold text-title text-white">Места</h1>
          <PlaceTypeFilter places={places.filter((p) => !notInterestedPlaces.has(p.id))} value={placeType} onChange={setPlaceType} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
          <MoodChips value={mood} onChange={setMood} savedCount={savedCount} kidsCount={places.filter((p) => p.kidsLevel).length} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 text-white">
          <div className="text-[48px] mb-3">{mood === 'saved' ? '🔖' : '📍'}</div>
          <p className="font-serif font-bold text-title">{mood === 'saved' ? 'Пока ничего не сохранено' : places.length ? 'Под это настроение мест пока нет' : 'Места скоро появятся'}</p>
          <p className="mt-2 text-body text-white/70">
            {mood === 'saved'
              ? 'Нажимай 🔖 на местах, которые хочешь посетить — они соберутся здесь.'
              : 'Скоро здесь будут самые классные и вайбовые места города.'}
          </p>
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
              onNotInterested={() => {
                notInterestedPlaces.add(place.id);
                setHiddenVersion((v) => v + 1);
                setJustHidden(place);
                api.hidePlace(place.id).catch(() => {});
              }}
            />
          ))}
        </div>
      )}


      {justHidden && (
        <UndoToast
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
}> = ({ place, isFirst, onOpen, onToggleSave, onCreateEvent, onNotInterested }) => {
  const [photoIndex, setPhotoIndex] = useState(0);
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

  return (
    <SwipeReel
      rightLabel={place.isSaved ? undefined : '🔖 Сохранить'}
      rightBehavior="next"
      leftLabel={place.isSaved ? undefined : 'Неинтересно'}
      leftBehavior="remove"
      onSwipe={(dir) => (dir === 'right' ? save() : onNotInterested())}
    >
      {/* Фото: тап по центру — карточка места; если фото несколько, по краям — листать (как в сторис) */}
      {place.photos.length > 0 ? (
        <div className="absolute inset-0">
          {place.photos.map((photo, i) => (
            <img
              key={photo}
              src={serverUrl(photo)}
              alt={place.name}
              draggable={false}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${i === photoIndex ? 'opacity-100' : 'opacity-0'}`}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ))}
          <div className="absolute inset-0 flex">
            {place.photos.length > 1 && (
              <button aria-label="Предыдущее фото" className="w-[22%] h-full cursor-pointer" onClick={() => setPhotoIndex((i) => Math.max(0, i - 1))} />
            )}
            <button aria-label="Открыть карточку места" className="flex-1 h-full cursor-pointer" onClick={onOpen} />
            {place.photos.length > 1 && (
              <button
                aria-label="Следующее фото"
                className="w-[22%] h-full cursor-pointer"
                onClick={() => setPhotoIndex((i) => (i + 1) % place.photos.length)}
              />
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={onOpen}
          className="absolute inset-0 bg-gradient-to-br from-[#5B7B68] to-[#2B2623] flex items-start justify-center pt-[38%] text-[96px] cursor-pointer"
        >
          {PLACE_MOODS[place.moods[0]]?.emoji || '📍'}
        </div>
      )}

      {/* Точки — сколько фото */}
      {place.photos.length > 1 && (
        <div className="absolute top-28 inset-x-0 z-10 flex justify-center gap-1.5 pointer-events-none">
          {place.photos.map((photo, i) => (
            <span key={photo} className={`h-1.5 rounded-full transition-all ${i === photoIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
          ))}
        </div>
      )}

      {/* Кнопки справа, как в Reels: только главное, маршрут — в подробностях */}
      <div className="absolute right-3 bottom-40 z-20 flex flex-col items-center gap-5 text-white">
        <button onClick={save} aria-label={place.isSaved ? 'Убрать из сохранённых' : 'Сохранить'} className="flex flex-col items-center gap-1 cursor-pointer">
          <span className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur ${place.isSaved ? 'bg-zine-sage' : 'bg-black/35'}`}>
            {place.isSaved ? <BookmarkCheck size={24} /> : <Bookmark size={24} />}
          </span>
          <span className="text-cap font-semibold drop-shadow">{place.isSaved ? 'Сохранено' : 'Сохранить'}</span>
        </button>
        <button onClick={() => onCreateEvent(place)} aria-label="Собрать сходку сюда" className="flex flex-col items-center gap-1 cursor-pointer">
          <span className="w-12 h-12 rounded-full bg-zine-terracotta flex items-center justify-center">
            <CalendarPlus size={22} />
          </span>
          <span className="text-cap font-semibold drop-shadow">Сходка</span>
        </button>
      </div>

      {/* Текст внизу на затемнении */}
      <div
        onClick={(e) => {
          // Нажатие на название, описание или фото под затемнением — открыть карточку; кнопки работают сами
          if (!(e.target as HTMLElement).closest('button')) onOpen();
        }}
        className="absolute inset-x-0 bottom-0 z-10 px-4 pt-24 pb-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent text-white cursor-pointer"
      >
        {/* Одна строка-подпись: тип · рейтинг · с детьми */}
        {(place.category || place.rating || place.kidsLevel) && (
          <p className="pr-16 text-sm2 font-semibold text-white/85 flex items-center gap-x-2 whitespace-nowrap overflow-hidden">
            {[
              place.category ? `${placeTypeEmoji(place.category)} ${place.category}` : '',
              place.rating ? `★ ${place.rating.toFixed(1).replace('.', ',')}` : '',
              place.kidsLevel && KIDS_LEVELS[place.kidsLevel] ? `👶 ${KIDS_LEVELS[place.kidsLevel].tiny}` : ''
            ]
              .filter(Boolean)
              .map((part, i) => (
                <span key={part} className={part.startsWith('★') ? 'text-[#FFD36B]' : ''}>
                  {i > 0 && <span className="mr-2 text-white/40">·</span>}
                  {part}
                </span>
              ))}
          </p>
        )}
        <h2 className="mt-1 pr-16 font-serif font-bold text-display leading-tight">{place.name}</h2>
        {place.description && <p className="mt-1.5 pr-16 text-body text-white/85 line-clamp-2">{place.description}</p>}
        <span className="mt-3 inline-flex items-center gap-1 text-sm2 font-bold text-white">
          Подробнее
          {place.tipsCount + (place.reviews?.length || 0) > 0 && (
            <span className="font-semibold text-white/70">· 💬 {place.tipsCount + (place.reviews?.length || 0)}</span>
          )}
          <ChevronRight size={18} />
        </span>
      </div>

      {/* Подсказка про свайпы — только на первой карточке */}
      {isFirst && <SwipeHint left={place.isSaved ? undefined : 'неинтересно'} right={place.isSaved ? undefined : 'сохранить'} />}
    </SwipeReel>
  );
};

export default PlacesScreen;
