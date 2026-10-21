import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, CalendarPlus, BookOpen, Loader2, Trash2, Bookmark, BookmarkCheck, Star } from 'lucide-react';
import { PlaceItem, PlaceTipItem, PLACE_MOODS, PLACE_PRICES } from '../../types';
import { api, serverUrl } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';

/**
 * Карточка места: фото, настроения, совет Миши, советы людей, «Как добраться», «Собрать сходку сюда»
 */
export const PlaceSheet: React.FC<{
  place: PlaceItem;
  onClose: () => void;
  onCreateEvent: (place: PlaceItem) => void;
  onToggleSave: (place: PlaceItem) => Promise<void>;
}> = ({ place, onClose, onCreateEvent, onToggleSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [tips, setTips] = useState<PlaceTipItem[]>([]);
  const [isTipsLoading, setIsTipsLoading] = useState(true);
  const [tipText, setTipText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    api
      .getPlaceTips(place.id)
      .then(setTips)
      .catch(() => {})
      .finally(() => setIsTipsLoading(false));
  }, [place.id]);

  const sendTip = async () => {
    if (!tipText.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const { tip } = await api.addPlaceTip(place.id, tipText.trim());
      setTips((prev) => [tip, ...prev]);
      setTipText('');
      telegramService.haptic('success');
    } catch (err: any) {
      setError(err.message || 'Не получилось сохранить совет');
    } finally {
      setIsSending(false);
    }
  };

  const deleteTip = async (id: string) => {
    try {
      await api.deletePlaceTip(id);
      setTips((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // не страшно
    }
  };

  const [lat, lng] = place.coordinates;
  const marks = [place.price ? PLACE_PRICES[place.price] : '', place.rainOk ? '☔ Ок в дождь' : '', place.evening ? '🌙 Лучше вечером' : '', place.oneDay ? '🧳 Туристам за один день' : ''].filter(Boolean);

  return (
    <BottomSheet title={place.name} onClose={onClose}>
      {/* Фото: листаются пальцем */}
      {place.photos.length > 0 && (
        <div className="relative -mx-5">
          <div
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
            onScroll={(e) => {
              const el = e.currentTarget;
              setPhotoIndex(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {place.photos.map((photo) => (
              <div key={photo} className="w-full shrink-0 snap-center px-5">
                <img src={serverUrl(photo)} alt={place.name} className="w-full aspect-[4/3] object-cover bg-zine-card rounded-zine" />
              </div>
            ))}
          </div>
          {place.photos.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {place.photos.map((photo, i) => (
                <span key={photo} className={`h-2 rounded-full transition-all ${i === photoIndex ? 'w-5 bg-zine-terracotta' : 'w-2 bg-zine-border'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {place.category && <p className="mt-4 text-cap font-bold uppercase tracking-wider text-zine-inkMuted">{place.category}</p>}
      {place.description && <p className={`${place.category ? 'mt-1' : 'mt-4'} text-lead text-zine-ink`}>{place.description}</p>}

      {/* Настроения — ведут в рубрики блога */}
      <div className="mt-3 -mx-5 pl-5 pr-10 flex gap-2 overflow-x-auto no-scrollbar fade-right">
        {place.moods.map((m) => (
          <button
            key={m}
            onClick={() => telegramService.openLink(PLACE_MOODS[m].blog)}
            className="h-10 px-3.5 shrink-0 whitespace-nowrap rounded-full bg-zine-sage/15 text-zine-ink text-sm2 font-semibold cursor-pointer"
          >
            {PLACE_MOODS[m].emoji} {PLACE_MOODS[m].label}
          </button>
        ))}
      </div>

      {marks.length > 0 && <p className="mt-3 text-sm2 text-zine-inkMuted">{marks.join(' · ')}</p>}

      {/* 🔖 Сохранить в свой список «хочу сходить» */}
      <button
        onClick={async () => {
          if (isSaving) return;
          telegramService.haptic(place.isSaved ? 'light' : 'success');
          setIsSaving(true);
          try {
            await onToggleSave(place);
          } finally {
            setIsSaving(false);
          }
        }}
        className={`mt-4 w-full h-12 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 border-2 transition-colors cursor-pointer ${
          place.isSaved ? 'bg-zine-sage/15 border-zine-sage text-zine-sage' : 'bg-zine-cardElevated border-zine-border text-zine-ink'
        }`}
      >
        {isSaving ? <Loader2 size={20} className="animate-spin" /> : place.isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        <span>{place.isSaved ? 'Сохранено — в моём списке' : 'Сохранить — хочу сходить'}</span>
      </button>

      {place.address && place.address !== place.name && (
        <p className="mt-3 flex items-center gap-2 text-body text-zine-ink">
          <MapPin size={20} className="text-zine-terracotta shrink-0" />
          <span>{place.address}</span>
        </p>
      )}

      {/* Совет автора */}
      {place.mishaTip && (
        <div className="mt-4 p-4 rounded-zine bg-zine-mustard/15 border border-zine-mustard/30">
          <p className="text-sm2 font-bold text-zine-ink">💡 Совет от Миши</p>
          <p className="mt-1 text-body text-zine-ink">{place.mishaTip}</p>
        </div>
      )}

      {/* Кнопки */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => telegramService.openLink(`https://yandex.by/maps/?rtext=~${lat},${lng}&rtt=pd`)}
          className="h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Navigation size={20} />
          <span>Как добраться</span>
        </button>
        <button
          onClick={() => onCreateEvent(place)}
          className="h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <CalendarPlus size={20} />
          <span>Сходка сюда</span>
        </button>
      </div>
      {place.mapUrl && (
        <button
          onClick={() => telegramService.openLink(place.mapUrl)}
          className="mt-2 w-full h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Star size={20} />
          <span>Отзывы и фото на Яндекс Картах</span>
        </button>
      )}
      {place.blogUrl && (
        <button
          onClick={() => telegramService.openLink(place.blogUrl)}
          className="mt-2 w-full h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <BookOpen size={20} />
          <span>Читать в блоге</span>
        </button>
      )}

      {/* Советы людей */}
      <div className="mt-6">
        <h4 className="text-lead font-bold text-zine-ink">Советы людей {tips.length > 0 && <span className="text-zine-inkMuted font-medium">· {tips.length}</span>}</h4>

        <div className="mt-3 flex gap-2">
          <textarea
            rows={2}
            maxLength={300}
            value={tipText}
            onChange={(e) => setTipText(e.target.value)}
            placeholder="Твой совет: что заказать, когда лучше прийти…"
            className="field flex-1"
          />
        </div>
        {tipText.trim() && (
          <button
            onClick={sendTip}
            disabled={isSending}
            className="mt-2 w-full h-12 rounded-zine-sm bg-zine-ink text-zine-paper text-body font-bold flex items-center justify-center cursor-pointer"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : 'Поделиться советом'}
          </button>
        )}
        {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}

        <div className="mt-4 space-y-3">
          {isTipsLoading ? (
            <p className="text-sm2 text-zine-inkMuted">Загружаем…</p>
          ) : tips.length === 0 ? (
            <p className="text-sm2 text-zine-inkMuted">Пока никто не поделился советом. Будь первым 🙂</p>
          ) : (
            tips.map((tip) => (
              <div key={tip.id} className="flex gap-3">
                {tip.avatarUrl ? (
                  <img src={tip.avatarUrl} alt={tip.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-zine-card flex items-center justify-center text-body font-bold text-zine-inkMuted shrink-0">
                    {tip.name.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm2 font-bold text-zine-ink">{tip.name}</p>
                  <p className="text-body text-zine-ink break-words">{tip.text}</p>
                </div>
                {tip.isMine && (
                  <button onClick={() => deleteTip(tip.id)} aria-label="Удалить мой совет" className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-zine-inkMuted cursor-pointer">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
