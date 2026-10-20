import React, { useState } from 'react';
import { MapPin, Plus, Clock, Check, Loader2, Edit2, Trash2, Navigation, Search, Share2 } from 'lucide-react';
import { AppEvent, EventCategory, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';
import { BottomSheet } from '../components/ui/BottomSheet';
import { formatEventDate } from './MapScreen';
import { ReportSheet } from '../components/common/ReportSheet';

export const MINSK_SPOTS_PRESETS: Array<{ name: string; aliases: string[]; coords: [number, number] }> = [
  { name: 'ул. Ленина 5', aliases: ['ленина 5', 'ленина, 5', 'ул. ленина 5', 'ленина'], coords: [53.8998, 27.5585] },
  { name: 'Октябрьская 19', aliases: ['октябрьская 19', 'октябрьская', 'oktyabr'], coords: [53.8905, 27.5740] },
  { name: 'Зыбицкая 6', aliases: ['зыбицкая 6', 'зыбицкая'], coords: [53.9056, 27.5585] },
  { name: 'Немига 3', aliases: ['немига 3', 'немига', 'верхний город'], coords: [53.9045, 27.5520] },
  { name: 'Осмоловка / Киселёва', aliases: ['осмоловк', 'киселёв', 'зерно'], coords: [53.9115, 27.5612] },
  { name: 'пр-т Независимости 4', aliases: ['независимости 4', 'независимост'], coords: [53.8965, 27.5510] },
  { name: 'Galleria Minsk (Победителей 9)', aliases: ['победителей 9', 'победител', 'галерея', 'galleria'], coords: [53.9095, 27.5480] },
  { name: 'Песочница (Куйбышева 45)', aliases: ['песочниц', 'куйбышева 45', 'куйбышев'], coords: [53.9155, 27.5690] },
  { name: 'Комаровка', aliases: ['комаровк'], coords: [53.9190, 27.5800] },
  { name: 'Парк Челюскинцев', aliases: ['челюскин', 'ботаническ'], coords: [53.9240, 27.6150] },
  { name: 'Парк Горького', aliases: ['горьког'], coords: [53.9030, 27.5760] },
  { name: 'Площадь Победы', aliases: ['площадь побед', 'пл. побед'], coords: [53.9085, 27.5750] },
  { name: 'Новая Боровая', aliases: ['боров'], coords: [53.9550, 27.6750] },
  { name: 'Восток / Dana Mall', aliases: ['восток', 'библиотек', 'dana mall', 'дана молл'], coords: [53.9335, 27.6530] },
  { name: 'Уручье / Музей валунов', aliases: ['уручь', 'музей валунов', 'валун'], coords: [53.9450, 27.6880] }
];

export interface FoundPlace {
  coords: [number, number]; // [lat, lng]
  label: string;            // что нашли — показываем пользователю для проверки
}

// Слова-уточнения, которые мешают поиску адреса («у входа», «возле кафе»…)
const FILLER_RE = /(?:^|[\s,]+)(у|возле|около|напротив|рядом\s+с|за|перед|под|над|во\s+дворе|в\s+холле|вход|подъезд|этаж)(?=[\s,.]|$).*$/i;

/**
 * Варианты адреса для поиска: целиком, без уточнений после запятых, без слов «у входа» и т.п.
 * «Юрово-Завальная 15, у входа» → «Юрово-Завальная 15, у входа», «Юрово-Завальная 15»
 */
const addressVariants = (address: string): string[] => {
  const variants: string[] = [address];
  const noFiller = address.replace(FILLER_RE, '').replace(/[,\s]+$/, '').trim();
  if (noFiller) variants.push(noFiller);
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  for (let n = parts.length - 1; n >= 1; n--) variants.push(parts.slice(0, n).join(', '));
  return [...new Set(variants)].filter((v) => v.length >= 3);
};

const withCity = (q: string) => (q.toLowerCase().includes('минск') ? q : `Беларусь, Минск, ${q}`);
const inMinsk = (lat: number, lng: number) => lat >= 53.7 && lat <= 54.1 && lng >= 27.3 && lng <= 27.85;

// Яндекс: принимаем только конкретное место (дом, улица, метро, парк), а не «весь Минск»
const geocodeYandex = async (q: string): Promise<FoundPlace | null> => {
  const ymaps = (window as any).ymaps;
  if (!ymaps || typeof ymaps.geocode !== 'function') return null;
  const res = await ymaps.geocode(withCity(q), { results: 1 });
  const obj = res.geoObjects?.get?.(0);
  if (!obj) return null;
  const kind = obj.properties?.get('metaDataProperty.GeocoderMetaData.kind');
  if (['country', 'province', 'area', 'locality'].includes(kind)) return null;
  const [a, b] = (obj.geometry?.getCoordinates() || []).map(Number);
  const coords: [number, number] = a > b ? [a, b] : [b, a];
  if (!inMinsk(coords[0], coords[1])) return null;
  const line: string = obj.getAddressLine?.() || obj.properties?.get('name') || q;
  return { coords, label: line.replace(/^Беларусь,\s*/, '').replace(/^Минск,\s*/, '') };
};

// OpenStreetMap: запасной вариант
const geocodeOsm = async (q: string): Promise<FoundPlace | null> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(withCity(q))}`,
    { headers: { 'Accept-Language': 'ru' } }
  );
  if (!response.ok) return null;
  const data = await response.json();
  if (!Array.isArray(data) || !data[0]) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (isNaN(lat) || isNaN(lng) || !inMinsk(lat, lng)) return null;
  // «15, Юрово-Завальная улица, …» → «Юрово-Завальная улица, 15»
  const [first, second] = String(data[0].display_name || q).split(',').map((p: string) => p.trim());
  const label = /^\d/.test(first) && second ? `${second}, ${first}` : first;
  return { coords: [lat, lng], label };
};

/**
 * Ищет место встречи. Возвращает null, если адрес не нашёлся —
 * тогда не ставим сходку куда попало, а просим уточнить адрес
 */
export const findEventPlace = async (address: string): Promise<FoundPlace | null> => {
  const trimmed = address.trim();
  if (!trimmed) return null;

  for (const variant of addressVariants(trimmed)) {
    try {
      const found = await geocodeYandex(variant);
      if (found) return found;
    } catch (err) {
      console.warn('Yandex Geocode error:', err);
    }
  }

  // Популярные места Минска
  const lower = trimmed.toLowerCase();
  const spot = MINSK_SPOTS_PRESETS.find((s) => s.aliases.some((alias) => lower.includes(alias)));
  if (spot) return { coords: spot.coords, label: spot.name };

  for (const variant of addressVariants(trimmed)) {
    try {
      const found = await geocodeOsm(variant);
      if (found) return found;
    } catch (err) {
      console.warn('Nominatim error:', err);
    }
  }

  return null;
};

export interface EventsScreenProps {
  events: AppEvent[];
  currentUserId?: number;
  onCreateEvent?: (eventData: {
    title: string;
    description: string;
    category: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }) => Promise<any>;
  onUpdateEvent?: (eventId: string, eventData: {
    title: string;
    description: string;
    category: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }) => Promise<any>;
  onDeleteEvent?: (eventId: string) => Promise<any> | void;
  onToggleJoin?: (event: AppEvent) => Promise<boolean> | void;
  onRefreshEvents?: () => void;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  events,
  currentUserId: propUserId,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onToggleJoin,
  onRefreshEvents
}) => {
  const currentTgUser = telegramService.getUser();
  const currentUserId = propUserId || currentTgUser?.id;

  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportEvent, setReportEvent] = useState<AppEvent | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('walk');
  const [locationName, setLocationName] = useState('');
  const [customCoords, setCustomCoords] = useState<[number, number] | null>(null);
  // Что нашли по адресу: подпись для проверки или «не нашли»
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [placeNotFound, setPlaceNotFound] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [dateTime, setDateTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredEvents = selectedCategory === 'all'
    ? events
    : events.filter((e) => e.category === selectedCategory);

  const handleOpenCreateModal = (presetCategory?: EventCategory) => {
    telegramService.haptic('selection');
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    const startCategory = presetCategory || 'walk';
    setCategory(startCategory);
    setLocationName('');
    setCustomCoords(null);
    setPlaceLabel(null);
    setPlaceNotFound(false);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(0, 0, 0);
    setDateTime(tomorrow.toISOString().slice(0, 16));
    setMaxParticipants('0');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev: AppEvent) => {
    telegramService.haptic('selection');
    const targetId = String(ev.id || (ev as any)._id);
    setEditingEventId(targetId);
    setTitle(ev.title || '');
    setDescription(ev.description || '');
    setCategory(ev.category || 'walk');
    setLocationName(ev.locationName || '');
    setCustomCoords(ev.coordinates || null);
    setPlaceLabel(ev.coordinates ? ev.locationName : null);
    setPlaceNotFound(false);
    try {
      const d = new Date(ev.dateTime);
      setDateTime(d.toISOString().slice(0, 16));
    } catch {
      setDateTime('');
    }
    setMaxParticipants(String(ev.maxParticipants || 0));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleGeocodeAddress = async (addr: string): Promise<FoundPlace | null> => {
    if (!addr.trim()) return null;
    setIsGeocoding(true);
    try {
      const found = await findEventPlace(addr.trim());
      setCustomCoords(found ? found.coords : null);
      setPlaceLabel(found ? found.label : null);
      setPlaceNotFound(!found);
      telegramService.haptic(found ? 'selection' : 'warning');
      return found;
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается');
      return;
    }
    setIsLocating(true);
    telegramService.haptic('selection');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setCustomCoords([lat, lng]);
        setPlaceLabel('Твоё текущее место (по GPS)');
        setPlaceNotFound(false);
        telegramService.haptic('success');
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS error:', err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleDeleteEvent = async (ev: AppEvent) => {
    const targetId = ev.id || (ev as any)._id;
    if (!targetId) return;
    if (!window.confirm(`Удалить сходку "${ev.title}"?`)) return;

    setDeletingId(String(targetId));
    try {
      if (onDeleteEvent) {
        await onDeleteEvent(String(targetId));
      } else {
        await api.deleteEvent(String(targetId));
      }
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleJoin = async (event: AppEvent) => {
    const targetId = event.id || (event as any)._id;
    setJoiningId(String(targetId));
    try {
      if (onToggleJoin) {
        await onToggleJoin(event);
      } else {
        await api.toggleJoinEvent(String(targetId), Boolean(event.isJoined));
      }
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      alert(err.message || 'Ошибка обновления участия');
    } finally {
      setJoiningId(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !locationName.trim() || !dateTime) {
      setFormError('Заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    try {
      // Всегда определяем точные координаты по введенному адресу
      let resolvedCoords = customCoords;
      if (!resolvedCoords || resolvedCoords.length !== 2) {
        const found = await handleGeocodeAddress(locationName.trim());
        if (!found) {
          setFormError('Не нашли этот адрес на карте. Напиши улицу и номер дома или нажми «Я сейчас здесь».');
          return;
        }
        resolvedCoords = found.coords;
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        locationName: locationName.trim(),
        coordinates: resolvedCoords,
        dateTime: new Date(dateTime).toISOString(),
        maxParticipants: Number(maxParticipants) || 0
      };

      if (editingEventId) {
        if (onUpdateEvent) {
          await onUpdateEvent(editingEventId, payload);
        } else {
          await api.updateEvent(editingEventId, payload);
        }
      } else {
        if (onCreateEvent) {
          await onCreateEvent(payload);
        } else {
          await api.createEvent(payload);
        }
      }

      setIsModalOpen(false);
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения сходки');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-zine-paper overflow-hidden">
      <header className="shrink-0 px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <h1 className="font-serif font-bold text-display text-zine-ink">Сходки</h1>
        <button
          onClick={() => handleOpenCreateModal()}
          className="h-12 px-5 rounded-full bg-zine-terracotta hover:bg-zine-terracottaHover text-white text-body font-bold flex items-center gap-2 shadow-zine-sm active:scale-95 transition-transform cursor-pointer"
        >
          <Plus size={22} strokeWidth={2.5} />
          <span>Создать</span>
        </button>
      </header>

      {/* Фильтры категорий */}
      <div className="shrink-0 pb-3 flex gap-2 overflow-x-auto no-scrollbar px-4">
        {([['all', 'Все', ''], ...(Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).map((c) => [c, EVENT_CATEGORIES_CONFIG[c].label, EVENT_CATEGORIES_CONFIG[c].emoji])] as [EventCategory | 'all', string, string][]).map(([id, label, emoji]) => {
          const isActive = selectedCategory === id;
          return (
            <button
              key={id}
              onClick={() => {
                telegramService.haptic('selection');
                setSelectedCategory(id);
              }}
              className={`h-11 px-4 shrink-0 rounded-full text-sm2 font-semibold whitespace-nowrap flex items-center gap-2 border transition-colors cursor-pointer ${
                isActive ? 'bg-zine-ink text-zine-paper border-zine-ink' : 'bg-zine-cardElevated text-zine-ink border-zine-border'
              }`}
            >
              {emoji && <span className="text-[18px] leading-none">{emoji}</span>}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Список сходок */}
      <main className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="mt-6 p-8 rounded-zine bg-zine-card text-center">
            <div className="text-[44px] mb-3">🗓</div>
            <h3 className="font-serif font-bold text-title text-zine-ink mb-2">Сходок пока нет</h3>
            <p className="text-body text-zine-inkMuted mb-5">Собери компанию на прогулку, в кафе или в музей — это займёт минуту.</p>
            <button
              onClick={() => handleOpenCreateModal()}
              className="h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer"
            >
              Создать сходку
            </button>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const cat = EVENT_CATEGORIES_CONFIG[ev.category] || EVENT_CATEGORIES_CONFIG.walk;
            const isCreator = Boolean(
              currentUserId && (
                Number(ev.creator?.telegramId) === Number(currentUserId) ||
                (ev as any).creatorId === String(currentUserId)
              )
            );
            const isJoining = joiningId === String(ev.id);
            const isFull = !ev.isJoined && Boolean(ev.maxParticipants) && (ev.participantsCount || 1) >= ev.maxParticipants;
            const isDeleting = deletingId === String(ev.id);

            return (
              <article
                key={ev.id}
                className={`p-4 rounded-zine bg-zine-cardElevated shadow-zine-sm ${ev.isOfficial ? 'border-2 border-zine-terracotta' : 'border border-zine-border'}`}
              >
                {ev.isOfficial && (
                  <p className="mb-2 text-sm2 font-bold text-zine-terracotta">⭐ От ДА! МИНСК — приходи, тут рады новичкам</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold ${cat.badgeBg} ${cat.badgeText}`}>
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </span>
                  {isCreator && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenEditModal(ev)}
                        aria-label="Изменить сходку"
                        className="w-11 h-11 rounded-full bg-zine-card text-zine-ink flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        <Edit2 size={19} />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev)}
                        disabled={isDeleting}
                        aria-label="Удалить сходку"
                        className="w-11 h-11 rounded-full bg-zine-danger/10 text-zine-danger flex items-center justify-center cursor-pointer active:scale-95"
                      >
                        {isDeleting ? <Loader2 size={19} className="animate-spin" /> : <Trash2 size={19} />}
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="mt-3 font-serif font-bold text-title text-zine-ink">{ev.title}</h3>

                <div className="mt-2 space-y-1.5 text-body text-zine-ink">
                  <p className="flex items-center gap-2.5">
                    <Clock size={20} className="text-zine-terracotta shrink-0" />
                    <span className="font-semibold">{formatEventDate(ev.dateTime)}</span>
                  </p>
                  <p className="flex items-center gap-2.5">
                    <MapPin size={20} className="text-zine-terracotta shrink-0" />
                    <span className="truncate">{ev.locationName}</span>
                  </p>
                </div>

                {ev.description && <p className="mt-3 text-body text-zine-inkMuted line-clamp-3 whitespace-pre-wrap">{ev.description}</p>}

                <div className="mt-4 flex items-center gap-3">
                  <img
                    src={ev.creator?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={ev.creator?.name || 'Организатор'}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 text-sm2">
                    <p className="text-zine-ink font-semibold truncate">{isCreator ? 'Ты собираешь' : `Собирает ${ev.creator?.name || 'организатор'}`}</p>
                    <p className="text-zine-inkMuted">
                      Идут: {ev.participantsCount || 1}
                      {ev.maxParticipants ? ` из ${ev.maxParticipants}` : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleToggleJoin(ev)}
                    disabled={isJoining || isFull}
                    className={`flex-1 h-12 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${
                      ev.isJoined
                        ? 'bg-zine-sage/15 text-zine-sage'
                        : isFull
                        ? 'bg-zine-card text-zine-inkMuted cursor-default'
                        : 'bg-zine-terracotta hover:bg-zine-terracottaHover text-white'
                    }`}
                  >
                    {isFull ? (
                      <span>Мест нет</span>
                    ) : isJoining ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : ev.isJoined ? (
                      <>
                        <Check size={20} strokeWidth={3} />
                        <span>Я иду</span>
                      </>
                    ) : (
                      <span>Пойду!</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      telegramService.haptic('selection');
                      telegramService.shareEvent(ev);
                    }}
                    className="h-12 px-4 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <Share2 size={20} />
                    <span>Позвать</span>
                  </button>
                </div>
                {ev.isJoined && !isCreator && <p className="mt-2 text-cap text-zine-inkMuted text-center">Планы изменились? Нажми «Я иду» ещё раз</p>}
                {!isCreator && (
                  <button onClick={() => setReportEvent(ev)} className="mt-1 w-full h-10 text-cap font-semibold text-zine-inkMuted cursor-pointer">
                    ⚠️ Пожаловаться
                  </button>
                )}
              </article>
            );
          })
        )}
      </main>

      {reportEvent && (
        <ReportSheet
          targetType="event"
          targetId={reportEvent.id}
          targetName={reportEvent.title}
          onClose={() => setReportEvent(null)}
          onReported={() => setReportEvent(null)}
        />
      )}

      {/* Создание / редактирование сходки */}
      {isModalOpen && (
        <BottomSheet title={editingEventId ? 'Изменить сходку' : 'Новая сходка'} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmitForm} className="space-y-5">
            {formError && (
              <div className="p-3 rounded-zine-sm bg-zine-danger/10 text-zine-danger text-sm2 font-semibold">{formError}</div>
            )}

            <Field label="Как назовём?">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Прогулка по Осмоловке с кофе"
                className="field"
                required
              />
            </Field>

            <Field label="Что будем делать?">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).map((cat) => {
                  const cfg = EVENT_CATEGORIES_CONFIG[cat];
                  const isSelected = category === cat;
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setCategory(cat);
                      }}
                      className={`h-[72px] rounded-zine-sm border-2 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                        isSelected ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
                      }`}
                    >
                      <span className="text-[24px] leading-none">{cfg.emoji}</span>
                      <span className={`text-cap font-semibold ${isSelected ? 'text-zine-terracotta' : 'text-zine-ink'}`}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Где встречаемся?">
              <input
                type="text"
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value);
                  // Сбрасываем старую точку, чтобы адрес определился заново
                  setCustomCoords(null);
                  setPlaceLabel(null);
                  setPlaceNotFound(false);
                }}
                onBlur={() => {
                  if (locationName.trim()) {
                    handleGeocodeAddress(locationName.trim());
                  }
                }}
                placeholder="Например: ул. Ленина 5"
                className="field"
                required
              />

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleGeocodeAddress(locationName)}
                  disabled={isGeocoding || !locationName.trim()}
                  className="h-11 rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGeocoding ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  <span>Найти на карте</span>
                </button>
                <button
                  type="button"
                  onClick={handleGetGPS}
                  disabled={isLocating}
                  className="h-11 rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                  <span>Я сейчас здесь</span>
                </button>
              </div>

              {customCoords && placeLabel && !isGeocoding && (
                <p className="mt-2 p-3 rounded-zine-sm bg-zine-sage/15 flex items-start gap-2 text-sm2 text-zine-ink">
                  <Check size={18} strokeWidth={3} className="text-zine-sage shrink-0 mt-0.5" />
                  <span>
                    Нашли: <b>{placeLabel}</b>
                  </span>
                </p>
              )}
              {placeNotFound && !isGeocoding && (
                <p className="mt-2 p-3 rounded-zine-sm bg-zine-danger/10 text-sm2 text-zine-ink">
                  Не нашли такой адрес. Напиши улицу и номер дома, например «Юрово-Завальная 15». Уточнения вроде «у входа» можно оставить — мы их учтём.
                </p>
              )}

              <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-5 px-5">
                {MINSK_SPOTS_PRESETS.slice(0, 6).map((spot) => (
                  <button
                    type="button"
                    key={spot.name}
                    onClick={() => {
                      telegramService.haptic('selection');
                      setLocationName(spot.name);
                      setCustomCoords(spot.coords);
                      setPlaceLabel(spot.name);
                      setPlaceNotFound(false);
                    }}
                    className="h-10 px-3.5 shrink-0 rounded-full border border-zine-border bg-zine-cardElevated text-zine-ink text-sm2 whitespace-nowrap cursor-pointer"
                  >
                    {spot.name}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Когда?">
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="field"
                required
              />
            </Field>

            <Field label="Пару слов о встрече">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Какой план, кого ждём, во что одеться"
                className="field"
                required
              />
            </Field>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 rounded-zine-sm bg-zine-terracotta hover:bg-zine-terracottaHover text-white text-lead font-bold flex items-center justify-center gap-2 shadow-zine-sm active:scale-[0.99] transition-transform cursor-pointer"
            >
              {isSubmitting ? <Loader2 size={22} className="animate-spin" /> : editingEventId ? 'Сохранить' : 'Опубликовать'}
            </button>
          </form>
        </BottomSheet>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block mb-2 text-body font-bold text-zine-ink">{label}</label>
    {children}
  </div>
);

export default EventsScreen;
