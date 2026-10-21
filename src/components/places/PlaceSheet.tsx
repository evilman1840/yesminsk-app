import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, CalendarPlus, BookOpen, Loader2, Trash2, Bookmark, BookmarkCheck, Star, Clock, Phone, Globe, ChevronRight, Sparkles } from 'lucide-react';
import { PlaceItem, PlaceTipItem, PLACE_MOODS, PLACE_PRICES, placeTypeEmoji, formatRatingCount, KIDS_LEVELS } from '../../types';
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

      {/* Тип · рейтинг (ведёт к отзывам на Яндекс Картах) */}
      {(place.category || place.rating) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm2">
          {place.category && (
            <span className="font-semibold text-zine-inkMuted">
              {placeTypeEmoji(place.category)} {place.category}
            </span>
          )}
          {place.category && place.rating ? <span className="text-zine-border">·</span> : null}
          {place.rating ? (
            <button
              onClick={() => place.mapUrl && telegramService.openLink(place.mapUrl)}
              className="inline-flex items-center gap-1 font-semibold text-zine-ink cursor-pointer"
            >
              <Star size={16} className="text-zine-mustard fill-current" />
              {place.rating.toFixed(1).replace('.', ',')}
              {place.ratingCount ? <span className="font-normal text-zine-inkMuted">· {formatRatingCount(place.ratingCount)} на Яндекс Картах</span> : null}
              {place.mapUrl && <ChevronRight size={16} className="text-zine-inkMuted" />}
            </button>
          ) : null}
        </div>
      )}
      {place.description && <p className="mt-2 text-lead text-zine-ink">{place.description}</p>}

      {/* Главные действия — одним рядом */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <ActionButton
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
          active={place.isSaved}
          icon={isSaving ? <Loader2 size={22} className="animate-spin" /> : place.isSaved ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
          label={place.isSaved ? 'Сохранено' : 'Сохранить'}
        />
        <ActionButton
          onClick={() => telegramService.openLink(`https://yandex.by/maps/?rtext=~${lat},${lng}&rtt=pd`)}
          icon={<Navigation size={22} />}
          label="Маршрут"
        />
        <ActionButton onClick={() => onCreateEvent(place)} primary icon={<CalendarPlus size={22} />} label="Сходка сюда" />
      </div>

      {/* Куда с детьми */}
      {place.kidsLevel && KIDS_LEVELS[place.kidsLevel] && (
        <div className="mt-5 p-4 rounded-zine bg-zine-sky/10">
          <p className="text-body font-bold text-zine-ink">👶 {KIDS_LEVELS[place.kidsLevel].short}</p>
          {place.kidsNote && <p className="mt-1 text-sm2 text-zine-ink">{place.kidsNote}</p>}
        </div>
      )}

      {/* Совет автора */}
      {place.mishaTip && (
        <div className="mt-3 p-4 rounded-zine bg-zine-mustard/15">
          <p className="text-sm2 font-bold text-zine-ink">💡 Совет от Миши</p>
          <p className="mt-1 text-sm2 text-zine-ink">{place.mishaTip}</p>
        </div>
      )}

      {/* Адрес, часы, телефон, сайт, цена — одним списком */}
      {(place.hours || place.phone || place.website || marks.length > 0 || (place.address && place.address !== place.name)) && (
        <div className="mt-5 rounded-zine border border-zine-border divide-y divide-zine-border">
          {place.address && place.address !== place.name && (
            <InfoRow icon={<MapPin size={19} />} text={place.address} onClick={() => telegramService.openLink(`https://yandex.by/maps/?rtext=~${lat},${lng}&rtt=pd`)} />
          )}
          {place.hours && <InfoRow icon={<Clock size={19} />} text={place.hours === '24/7' ? 'Круглосуточно' : place.hours} />}
          {place.phone && <InfoRow icon={<Phone size={19} />} text={place.phone} onClick={() => telegramService.openLink(`tel:${place.phone!.replace(/[^\d+]/g, '')}`)} />}
          {place.website && (
            <InfoRow icon={<Globe size={19} />} text={place.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} onClick={() => telegramService.openLink(place.website!)} />
          )}
          {marks.length > 0 && <InfoRow icon={<Sparkles size={19} />} text={marks.join(' · ')} />}
        </div>
      )}

      {/* Настроения и удобства — лёгкой строкой */}
      {place.moods.length > 0 && (
        <div className="mt-4 -mx-5 pl-5 pr-10 flex gap-1.5 overflow-x-auto no-scrollbar fade-right">
          {place.moods.map((m) => (
            <button
              key={m}
              onClick={() => telegramService.openLink(PLACE_MOODS[m].blog)}
              className="h-9 px-3 shrink-0 whitespace-nowrap rounded-full bg-zine-sage/15 text-zine-ink text-sm2 font-semibold cursor-pointer"
            >
              {PLACE_MOODS[m].emoji} {PLACE_MOODS[m].label}
            </button>
          ))}
        </div>
      )}
      {place.amenities && place.amenities.length > 0 && (
        <p className="mt-3 text-sm2 text-zine-inkMuted">{place.amenities.map((a) => `${amenityEmoji(a)} ${a}`).join('  ·  ')}</p>
      )}

      {(place.blogUrl || (!place.rating && place.mapUrl)) && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {place.blogUrl && (
            <button onClick={() => telegramService.openLink(place.blogUrl)} className="inline-flex items-center gap-2 text-body font-semibold text-zine-terracotta cursor-pointer">
              <BookOpen size={19} />
              <span>Читать в блоге</span>
            </button>
          )}
          {!place.rating && place.mapUrl && (
            <button onClick={() => telegramService.openLink(place.mapUrl)} className="inline-flex items-center gap-2 text-body font-semibold text-zine-terracotta cursor-pointer">
              <Star size={19} />
              <span>Отзывы и фото на Яндекс Картах</span>
            </button>
          )}
        </div>
      )}

      {/* Что пишут на Яндекс Картах — отзывы из таблиц автора */}
      {place.reviews && place.reviews.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lead font-bold text-zine-ink">
            Что пишут <span className="text-zine-inkMuted font-medium">· {place.reviews.length}</span>
          </h4>
          <div className="mt-3 -mx-5 px-5 scroll-px-5 flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory">
            {place.reviews.map((r, i) => (
              <figure key={i} className="w-[82%] shrink-0 snap-start p-4 rounded-zine bg-zine-card flex flex-col">
                {r.rating ? (
                  <span className="flex gap-0.5 text-zine-mustard" aria-label={`Оценка ${r.rating} из 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={15} className={n <= r.rating! ? 'fill-current' : 'opacity-25'} />
                    ))}
                  </span>
                ) : null}
                <blockquote className="mt-2 text-body text-zine-ink">«{r.text}»</blockquote>
                <figcaption className="mt-auto pt-3 text-cap text-zine-inkMuted">Отзыв с {r.source === 'Яндекс Карты' ? 'Яндекс Карт' : r.source}</figcaption>
              </figure>
            ))}
          </div>
        </div>
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
            <p className="text-sm2 text-zine-inkMuted">Пока никто не поделился советом — твой будет первым 🙂</p>
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

// Строка «иконка — текст» в блоке адреса и контактов; с onClick — нажимается
const InfoRow: React.FC<{ icon: React.ReactNode; text: string; onClick?: () => void }> = ({ icon, text, onClick }) => {
  const content = (
    <>
      <span className="shrink-0 text-zine-terracotta">{icon}</span>
      <span className={`min-w-0 text-body ${onClick ? 'text-zine-ink underline decoration-zine-border underline-offset-4' : 'text-zine-ink'}`}>{text}</span>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer">
      {content}
    </button>
  ) : (
    <div className="px-4 py-3 flex items-center gap-3">{content}</div>
  );
};

// Значок к удобству по ключевым словам
const amenityEmoji = (a: string) => {
  const t = a.toLowerCase();
  if (t.includes('собач') || t.includes('собак')) return '🐕';
  if (t.includes('nfc') || t.includes('карт')) return '💳';
  if (t.includes('хайкинг')) return '🥾';
  if (t.includes('слабослыш')) return '🦻';
  if (t.includes('доступн') || t.includes('маломобил')) return '♿';
  if (t.includes('парковк')) return '🅿️';
  if (t.includes('wi-fi') || t.includes('wifi')) return '📶';
  return '✓';
};

// Кнопка из ряда главных действий: значок над подписью
const ActionButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; active?: boolean; primary?: boolean }> = ({
  onClick,
  icon,
  label,
  active,
  primary
}) => (
  <button
    onClick={onClick}
    className={`h-[68px] rounded-zine-sm flex flex-col items-center justify-center gap-1 text-sm2 font-bold active:scale-[0.97] transition-transform cursor-pointer ${
      primary ? 'bg-zine-terracotta text-white' : active ? 'bg-zine-sage/15 text-zine-sage' : 'bg-zine-card text-zine-ink'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
