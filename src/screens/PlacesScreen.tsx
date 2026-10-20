import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, Navigation, CalendarPlus, ChevronUp } from 'lucide-react';
import { PlaceItem, PLACE_MOODS } from '../types';
import { serverUrl } from '../services/api';
import { telegramService } from '../services/telegram';
import { MoodChips, MoodFilter } from '../components/places/MoodPicker';
import { PlaceSheet } from '../components/places/PlaceSheet';

/**
 * «Места» как Reels: полноэкранные карточки, листаются вверх-вниз, фото — вбок
 */
export const PlacesScreen: React.FC<{
  places: PlaceItem[];
  onToggleSave: (place: PlaceItem) => Promise<PlaceItem>;
  onCreateEvent: (place: PlaceItem) => void;
}> = ({ places, onToggleSave, onCreateEvent }) => {
  const [mood, setMood] = useState<MoodFilter>('all');
  const [openedPlace, setOpenedPlace] = useState<PlaceItem | null>(null);

  const savedCount = places.filter((p) => p.isSaved).length;
  const shown = mood === 'all' ? places : mood === 'saved' ? places.filter((p) => p.isSaved) : places.filter((p) => p.moods.includes(mood));

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
        <div className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
          {shown.map((place, index) => (
            <PlaceReel
              key={place.id}
              place={place}
              isFirst={index === 0}
              onOpen={() => setOpenedPlace(place)}
              onToggleSave={onToggleSave}
              onCreateEvent={onCreateEvent}
              onMood={setMood}
            />
          ))}
        </div>
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
}> = ({ place, isFirst, onOpen, onToggleSave, onCreateEvent, onMood }) => {
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
    <section className="relative h-full w-full snap-start snap-always overflow-hidden">
      {/* Фото листаются вбок */}
      {place.photos.length > 0 ? (
        <div
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => setPhotoIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {place.photos.map((photo) => (
            <img key={photo} src={serverUrl(photo)} alt={place.name} className="h-full w-full shrink-0 snap-center object-cover" loading="lazy" />
          ))}
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
        <div className="mt-2 -mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar">
          {place.moods.map((m) => (
            <button
              key={m}
              onClick={() => onMood(m)}
              className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full bg-white/20 backdrop-blur text-sm2 font-semibold text-white cursor-pointer"
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

      {/* Подсказка листать — только на первой карточке */}
      {isFirst && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center text-white/80 animate-bounce pointer-events-none">
          <ChevronUp size={22} />
          <span className="text-cap font-semibold">листай</span>
        </div>
      )}
    </section>
  );
};

export default PlacesScreen;
