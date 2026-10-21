import React, { useLayoutEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Navigation, CalendarPlus } from 'lucide-react';
import { PlaceItem, PLACE_MOODS } from '../types';
import { api, serverUrl } from '../services/api';
import { telegramService } from '../services/telegram';
import { MoodChips, MoodFilter } from '../components/places/MoodPicker';
import { PlaceSheet } from '../components/places/PlaceSheet';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { UndoToast } from '../components/ui/UndoToast';

// Места, смахнутые влево («Неинтересно»). На сервере тоже сохраняются —
// при следующем запуске сервер их уже не пришлёт
const notInterestedPlaces = new Set<string>();
export const forgetNotInterestedPlace = (id: string) => notInterestedPlaces.delete(id);

/**
 * «Места» как Reels: полноэкранные карточки, листаются вверх-вниз; свайп вправо — подробнее, влево — неинтересно; фото — тапом
 */
export const PlacesScreen: React.FC<{
  places: PlaceItem[];
  onToggleSave: (place: PlaceItem) => Promise<PlaceItem>;
  onCreateEvent: (place: PlaceItem) => void;
}> = ({ places, onToggleSave, onCreateEvent }) => {
  const [mood, setMood] = useState<MoodFilter>('all');
  const [openedPlace, setOpenedPlace] = useState<PlaceItem | null>(null);
  const [, setHiddenVersion] = useState(0); // перерисовать после «Неинтересно»
  const [justHidden, setJustHidden] = useState<PlaceItem | null>(null);

  const savedCount = places.filter((p) => p.isSaved).length;
  const shown = (mood === 'all' ? places : mood === 'saved' ? places.filter((p) => p.isSaved) : places.filter((p) => p.moods.includes(mood))).filter(
    (p) => !notInterestedPlaces.has(p.id)
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
        <h1 className="px-4 mb-2 font-serif font-bold text-title text-white">Места</h1>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
          <MoodChips value={mood} onChange={setMood} savedCount={savedCount} />
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
              onMood={setMood}
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
  onMood: (m: MoodFilter) => void;
  onNotInterested: () => void;
}> = ({ place, isFirst, onOpen, onToggleSave, onCreateEvent, onMood, onNotInterested }) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lat, lng] = place.coordinates;

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
      rightLabel="Подробнее"
      rightBehavior="stay"
      leftLabel={place.isSaved ? undefined : 'Неинтересно'}
      leftBehavior="remove"
      onSwipe={(dir) => (dir === 'right' ? onOpen() : onNotInterested())}
    >
      {/* Фото: тап по левой половине — назад, по правой — вперёд (как в сторис) */}
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
          {place.photos.length > 1 && (
            <div className="absolute inset-0 flex">
              <button aria-label="Предыдущее фото" className="w-1/2 h-full cursor-pointer" onClick={() => setPhotoIndex((i) => Math.max(0, i - 1))} />
              <button
                aria-label="Следующее фото"
                className="w-1/2 h-full cursor-pointer"
                onClick={() => setPhotoIndex((i) => (i + 1) % place.photos.length)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#5B7B68] to-[#2B2623] flex items-start justify-center pt-[38%] text-[96px]">
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

      {/* Кнопки справа, как в Reels */}
      <div className="absolute right-3 bottom-48 z-20 flex flex-col items-center gap-5 text-white">
        <button onClick={save} aria-label={place.isSaved ? 'Убрать из сохранённых' : 'Сохранить'} className="flex flex-col items-center gap-1 cursor-pointer">
          <span className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur ${place.isSaved ? 'bg-zine-sage' : 'bg-black/35'}`}>
            {place.isSaved ? <BookmarkCheck size={24} /> : <Bookmark size={24} />}
          </span>
          <span className="text-cap font-semibold drop-shadow">{place.isSaved ? 'Сохранено' : 'Сохранить'}</span>
        </button>
        <button
          onClick={() => telegramService.openLink(`https://yandex.by/maps/?rtext=~${lat},${lng}&rtt=pd`)}
          aria-label="Как добраться"
          className="flex flex-col items-center gap-1 cursor-pointer"
        >
          <span className="w-12 h-12 rounded-full bg-black/35 backdrop-blur flex items-center justify-center">
            <Navigation size={22} />
          </span>
          <span className="text-cap font-semibold drop-shadow">Маршрут</span>
        </button>
        <button onClick={() => onCreateEvent(place)} aria-label="Собрать сходку сюда" className="flex flex-col items-center gap-1 cursor-pointer">
          <span className="w-12 h-12 rounded-full bg-zine-terracotta flex items-center justify-center">
            <CalendarPlus size={22} />
          </span>
          <span className="text-cap font-semibold drop-shadow">Сходка</span>
        </button>
      </div>

      {/* Текст внизу на затемнении */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pt-24 pb-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent text-white">
        {place.category && <p className="text-cap font-bold uppercase tracking-wider text-white/75">{place.category}</p>}
        <h2 className="mt-1 pr-16 font-serif font-bold text-display leading-tight">{place.name}</h2>
        {/* Настроения: компактные, правый край растворяется — видно, что можно листать */}
        <div data-no-swipe className="mt-2 -mx-4 pl-4 pr-10 flex gap-1.5 overflow-x-auto no-scrollbar fade-right">
          {place.moods.map((m) => (
            <button
              key={m}
              onClick={() => onMood(m)}
              className="h-7 px-2.5 shrink-0 whitespace-nowrap rounded-full bg-white/20 backdrop-blur text-cap font-semibold text-white cursor-pointer"
            >
              {PLACE_MOODS[m].emoji} {PLACE_MOODS[m].label}
            </button>
          ))}
        </div>
        {place.description && <p className="mt-2 pr-16 text-body text-white/90 line-clamp-2">{place.description}</p>}
        <button
          onClick={onOpen}
          className="mt-3 h-12 px-5 rounded-full bg-white text-[#2B2623] text-body font-bold cursor-pointer active:scale-[0.98] transition-transform"
        >
          Подробнее {place.tipsCount > 0 ? `· 💬 ${place.tipsCount}` : ''}
        </button>
      </div>

      {/* Подсказка про свайпы — только на первой карточке */}
      {isFirst && <SwipeHint left={place.isSaved ? undefined : 'неинтересно'} right="подробнее" />}
    </SwipeReel>
  );
};

export default PlacesScreen;
