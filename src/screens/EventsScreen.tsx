import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Check, Loader2, Edit2, Trash2, Navigation, MapPinned, Share2 } from 'lucide-react';
import { AppEvent, EventCategory, EVENT_CATEGORIES_CONFIG, eventCategoryOf, EventTag, EVENT_TAGS, JoinOptions, EventWhen, EVENT_WHEN, matchesWhen } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';
import { BottomSheet } from '../components/ui/BottomSheet';
import { formatEventDate } from './MapScreen';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { MapPicker } from '../components/common/MapPicker';
import { EventDetails } from '../components/common/EventDetails';
import { JoinSheet } from '../components/common/JoinSheet';
import { UndoToast } from '../components/ui/UndoToast';
import { useClosingConfirmation, useMainButton } from '../hooks/useTelegram';

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

// Сходки, смахнутые влево («Неинтересно»). На сервере тоже сохраняются —
// при следующем запуске сервер их уже не пришлёт
const notInterestedEvents = new Set<string>();
export const forgetNotInterestedEvent = (id: string) => notInterestedEvents.delete(id);

export interface EventsScreenProps {
  events: AppEvent[];
  currentUserId?: number;
  onCreateEvent?: (eventData: {
    title: string;
    description: string;
    category: string;
    customCategory?: string;
    tags?: EventTag[];
    placeId?: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }) => Promise<any>;
  onUpdateEvent?: (eventId: string, eventData: {
    title: string;
    description: string;
    category: string;
    customCategory?: string;
    tags?: EventTag[];
    placeId?: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }) => Promise<any>;
  onDeleteEvent?: (eventId: string) => Promise<any> | void;
  // options — с кем идёшь; null — «Не пойду». Вернёт обновлённую сходку или null
  onJoin?: (event: AppEvent, options: JoinOptions | null) => Promise<AppEvent | null>;
  onRefreshEvents?: () => void;
  // «Сходка сюда» из карточки места: открыть форму с уже заполненным местом
  initialPlace?: { name: string; coordinates: [number, number]; category: EventCategory; placeId?: string } | null;
  onInitialPlaceUsed?: () => void;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  events,
  currentUserId: propUserId,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onJoin,
  onRefreshEvents,
  initialPlace,
  onInitialPlaceUsed
}) => {
  const currentTgUser = telegramService.getUser();
  const currentUserId = propUserId || currentTgUser?.id;

  // 'kids' — «👶 С детьми»: сходки, куда можно с детьми
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all' | 'kids'>('all');
  const [eventWhen, setEventWhen] = useState<EventWhen>('all'); // сегодня / завтра / выходные
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailsEventId, setDetailsEventId] = useState<string | null>(null);
  const [, setHiddenVersion] = useState(0); // перерисовать после «Неинтересно»
  const [justHidden, setJustHidden] = useState<AppEvent | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('walk');
  const [customCategory, setCustomCategory] = useState('');
  const [locationName, setLocationName] = useState('');
  const [customCoords, setCustomCoords] = useState<[number, number] | null>(null);
  // Что нашли по адресу: подпись для проверки или «не нашли»
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [placeNotFound, setPlaceNotFound] = useState(false);
  // Точку поставили на карте — правка текста адреса её не сбрасывает («у входа» и т.п.)
  const [isPickedOnMap, setIsPickedOnMap] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [dateTime, setDateTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('0');
  const [tags, setTags] = useState<EventTag[]>([]);
  // Сходка из карточки места — тогда напишем тем, кто его сохранил
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [joinEventId, setJoinEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  // «Опубликовать» — нативная MainButton; requestSubmit запускает и проверку required-полей
  const hasNativeSubmit = useMainButton({
    text: editingEventId ? 'Сохранить' : 'Опубликовать',
    onClick: () => formRef.current?.requestSubmit(),
    loading: isSubmitting,
    active: isModalOpen && !isMapPickerOpen
  });
  useClosingConfirmation(isModalOpen && Boolean(title.trim() || description.trim()));

  // Ошибка формы вверху шторки — прокручиваем к ней, кнопка-то внизу
  useEffect(() => {
    if (!formError) return;
    telegramService.haptic('error');
    formErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [formError]);

  const filteredEvents = (selectedCategory === 'all'
    ? events
    : selectedCategory === 'kids'
    ? events.filter((e) => e.tags?.includes('kids'))
    : events.filter((e) => e.category === selectedCategory)
  ).filter((e) => !notInterestedEvents.has(String(e.id)) && matchesWhen(e.dateTime, eventWhen));
  const detailsEvent = detailsEventId ? events.find((e) => String(e.id) === detailsEventId) || null : null;
  const joinEvent = joinEventId ? events.find((e) => String(e.id) === joinEventId) || null : null;
  // После «Вернуть» — сразу показываем возвращённую карточку
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!scrollToId) return;
    const index = filteredEvents.findIndex((item) => String(item.id) === scrollToId);
    const list = listRef.current;
    if (list && index >= 0) list.scrollTo({ top: index * list.clientHeight });
    setScrollToId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToId]);

  const handleOpenCreateModal = (presetCategory?: EventCategory, place?: { name: string; coordinates: [number, number]; placeId?: string }) => {
    setPlaceId(place?.placeId || null);
    telegramService.haptic('selection');
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    const startCategory = presetCategory || 'walk';
    setCategory(startCategory);
    setCustomCategory('');
    setLocationName(place?.name || '');
    setCustomCoords(place?.coordinates || null);
    setPlaceLabel(place?.name || null);
    setPlaceNotFound(false);
    setIsPickedOnMap(Boolean(place));
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(0, 0, 0);
    setDateTime(tomorrow.toISOString().slice(0, 16));
    setMaxParticipants('0');
    setTags([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Пришли из карточки места — сразу открываем форму с этим местом
  useEffect(() => {
    if (!initialPlace) return;
    handleOpenCreateModal(initialPlace.category, initialPlace);
    onInitialPlaceUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlace]);

  const handleOpenEditModal = (ev: AppEvent) => {
    telegramService.haptic('selection');
    const targetId = String(ev.id || (ev as any)._id);
    setEditingEventId(targetId);
    setTitle(ev.title || '');
    setDescription(ev.description || '');
    setCategory(ev.category || 'walk');
    setCustomCategory(ev.customCategory || '');
    setLocationName(ev.locationName || '');
    setCustomCoords(ev.coordinates || null);
    setPlaceLabel(ev.coordinates ? ev.locationName : null);
    setPlaceNotFound(false);
    setIsPickedOnMap(Boolean(ev.coordinates));
    try {
      const d = new Date(ev.dateTime);
      setDateTime(d.toISOString().slice(0, 16));
    } catch {
      setDateTime('');
    }
    setMaxParticipants(String(ev.maxParticipants || 0));
    setTags(ev.tags || []);
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
      telegramService.alert('Геолокация не поддерживается');
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
        setIsPickedOnMap(true);
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
    if (!(await telegramService.confirm(`Удалить сходку «${ev.title}»?`, { destructive: true }))) return;

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
      telegramService.alert(err.message || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  // Записаться / поменять, с кем идёшь / «Не пойду» (options = null)
  const handleJoin = async (event: AppEvent, options: JoinOptions | null) => {
    const targetId = String(event.id || (event as any)._id);
    setJoiningId(targetId);
    try {
      if (onJoin) {
        if (!(await onJoin(event, options))) return;
      } else if (options) {
        await api.joinEvent(targetId, options);
      } else {
        await api.leaveEvent(targetId);
      }
      onRefreshEvents?.();
    } catch (err: any) {
      telegramService.alert(err.message || 'Ошибка обновления участия');
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
    if (category === 'other' && !customCategory.trim()) {
      setFormError('Напиши, что будете делать — например, «Караоке»');
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
        customCategory: category === 'other' ? customCategory.trim() : '',
        locationName: locationName.trim(),
        coordinates: resolvedCoords,
        dateTime: new Date(dateTime).toISOString(),
        maxParticipants: Number(maxParticipants) || 0,
        tags,
        ...(placeId && !editingEventId ? { placeId } : {})
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

  const categoryIds = (Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).filter(
    (c) => c !== 'other' || events.some((e) => e.category === 'other')
  );

  return (
    <div className="relative h-full w-full bg-[#141210] overflow-hidden">
      {/* Заголовок и фильтры поверх карточек */}
      <div className="absolute top-0 inset-x-0 z-20 pt-3 pb-6 bg-gradient-to-b from-black/60 to-transparent">
        <div className="px-4 mb-2 flex items-center justify-between gap-3">
          <h1 className="font-serif font-bold text-title text-white">Сходки</h1>
          <button
            onClick={() => handleOpenCreateModal()}
            className="h-11 px-4 rounded-full bg-zine-terracotta active:bg-zine-terracottaHover text-white text-body font-bold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span>Создать</span>
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
          {([['all', 'Все', ''], ...categoryIds.map((c) => [c, EVENT_CATEGORIES_CONFIG[c].label, EVENT_CATEGORIES_CONFIG[c].emoji]), ['kids', 'С детьми', '👶']] as [EventCategory | 'all' | 'kids', string, string][]).map(([id, label, emoji]) => {
            const isActive = selectedCategory === id;
            return (
              <button
                key={id}
                onClick={() => {
                  telegramService.haptic('selection');
                  setSelectedCategory(id);
                }}
                className={`h-11 px-4 shrink-0 rounded-full text-sm2 font-semibold whitespace-nowrap flex items-center gap-2 border transition-colors cursor-pointer ${
                  isActive ? 'bg-zine-ink text-zine-paper border-zine-ink' : 'bg-zine-cardElevated text-zine-ink border-zine-border shadow-zine'
                }`}
              >
                {emoji && <span className="text-[18px] leading-none">{emoji}</span>}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        {/* Когда: сегодня / завтра / выходные — как на карте */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar px-4">
          {EVENT_WHEN.map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                telegramService.haptic('selection');
                setEventWhen(id);
              }}
              className={`h-9 px-3.5 shrink-0 rounded-full text-sm2 font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                eventWhen === id ? 'bg-white text-[#2B2623]' : 'bg-black/35 backdrop-blur text-white border border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 text-white">
          <div className="text-[48px] mb-3">🗓</div>
          <p className="font-serif font-bold text-title">Сходок пока нет</p>
          <p className="mt-2 text-body text-white/70">Собери компанию на прогулку, в кафе или за настолки — это займёт минуту.</p>
          <button
            onClick={() => {
              handleOpenCreateModal(selectedCategory === 'all' || selectedCategory === 'kids' ? undefined : selectedCategory);
              if (selectedCategory === 'kids') setTags(['kids']);
            }}
            className="mt-5 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer"
          >
            Создать сходку
          </button>
        </div>
      ) : (
        <div key={`${selectedCategory}-${eventWhen}`} ref={listRef} className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
          {filteredEvents.map((ev, index) => {
            const isCreator = Boolean(
              currentUserId && (
                Number(ev.creator?.telegramId) === Number(currentUserId) ||
                (ev as any).creatorId === String(currentUserId)
              )
            );
            return (
              <EventReel
                key={ev.id}
                event={ev}
                isFirst={index === 0}
                isCreator={isCreator}
                isJoining={joiningId === String(ev.id)}
                isDeleting={deletingId === String(ev.id)}
                onJoin={() => setJoinEventId(String(ev.id))}
                onEdit={() => handleOpenEditModal(ev)}
                onDelete={() => handleDeleteEvent(ev)}
                onOpenDetails={() => setDetailsEventId(String(ev.id))}
                onNotInterested={() => {
                  notInterestedEvents.add(String(ev.id));
                  setHiddenVersion((v) => v + 1);
                  setJustHidden(ev);
                  api.hideEvent(String(ev.id)).catch(() => {});
                }}
              />
            );
          })}
        </div>
      )}

      {justHidden && (
        <UndoToast
          topClass="top-[164px]"
          text={`Скрыто: ${justHidden.title}`}
          onDone={() => setJustHidden(null)}
          onUndo={() => {
            notInterestedEvents.delete(String(justHidden.id));
            api.hideEvent(String(justHidden.id), false).catch(() => {});
            setScrollToId(String(justHidden.id));
            setJustHidden(null);
            setHiddenVersion((v) => v + 1);
          }}
        />
      )}

      {/* «Пойду!» — сколько вас и с детьми ли */}
      {joinEvent && (
        <JoinSheet
          event={joinEvent}
          onConfirm={(o) => handleJoin(joinEvent, o)}
          onLeave={() => handleJoin(joinEvent, null)}
          onClose={() => setJoinEventId(null)}
        />
      )}

      {/* Подробности сходки — открываются свайпом вправо; там же «Пойду!» */}
      {detailsEvent && (
        <BottomSheet title={detailsEvent.title} onClose={() => setDetailsEventId(null)}>
          <EventDetails event={detailsEvent} onJoin={(o) => handleJoin(detailsEvent, o)} onReported={() => setDetailsEventId(null)} />
        </BottomSheet>
      )}

      {/* Создание / редактирование сходки */}
      {isModalOpen && (
        <BottomSheet title={editingEventId ? 'Изменить сходку' : 'Новая сходка'} onClose={() => setIsModalOpen(false)}>
          <form ref={formRef} onSubmit={handleSubmitForm} className="space-y-5">
            {formError && (
              <div ref={formErrorRef} className="p-3 rounded-zine-sm bg-zine-danger/10 text-zine-danger text-sm2 font-semibold">{formError}</div>
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
                {(Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).filter((c) => c !== 'other').map((cat) => {
                  const cfg = EVENT_CATEGORIES_CONFIG[cat];
                  const isSelected = category === cat;
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setCategory(cat);
                        // «Поныть» — маленькой группой, чтобы каждый успел выговориться
                        if (cat === 'support' && (maxParticipants === '0' || !maxParticipants)) setMaxParticipants('6');
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
              {/* Своя идея: автор сам пишет, что за сходка */}
              <button
                type="button"
                onClick={() => {
                  telegramService.haptic('selection');
                  setCategory('other');
                }}
                className={`mt-2 w-full h-14 px-4 rounded-zine-sm border-2 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  category === 'other' ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-dashed border-zine-border bg-zine-cardElevated'
                }`}
              >
                <span className="text-[24px] leading-none">✨</span>
                <span className={`text-sm2 font-semibold ${category === 'other' ? 'text-zine-terracotta' : 'text-zine-ink'}`}>
                  Своя идея — впиши свою
                </span>
              </button>
              {category === 'other' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value.slice(0, 30))}
                  placeholder="Караоке, йога в парке, квиз…"
                  className="field mt-2"
                  autoFocus
                />
              )}
            </Field>

            <Field label="Для кого?">
              <div className="flex flex-wrap gap-2">
                {/* «Всех» — по умолчанию: без пометок */}
                <button
                  type="button"
                  onClick={() => {
                    telegramService.haptic('selection');
                    setTags([]);
                  }}
                  className={`h-11 px-4 rounded-full border-2 text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    tags.length === 0 ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                  }`}
                >
                  🙌 Всех
                </button>
                {(Object.keys(EVENT_TAGS) as EventTag[]).map((t) => {
                  const isOn = tags.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setTags(isOn ? tags.filter((x) => x !== t) : [...tags, t]);
                      }}
                      className={`h-11 px-4 rounded-full border-2 text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isOn ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                      }`}
                    >
                      {EVENT_TAGS[t].emoji} {EVENT_TAGS[t].label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Сколько мест?">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxParticipants === '0' ? '' : maxParticipants}
                  onChange={(e) => setMaxParticipants(String(Math.max(0, Math.floor(Number(e.target.value) || 0))))}
                  placeholder="Без ограничений"
                  className="field flex-1"
                />
              </div>
              <p className="mt-1.5 text-cap text-zine-inkMuted">Вместе с тобой и гостями участников. Пусто — сколько угодно</p>
            </Field>

            <Field label="Где встречаемся?">
              <input
                type="text"
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value);
                  if (isPickedOnMap) return; // точка уже стоит — текст лишь уточняет её
                  // Сбрасываем старую точку, чтобы адрес определился заново
                  setCustomCoords(null);
                  setPlaceLabel(null);
                  setPlaceNotFound(false);
                }}
                onBlur={() => {
                  if (locationName.trim() && !customCoords) {
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
                  onClick={() => {
                    telegramService.haptic('selection');
                    setIsMapPickerOpen(true);
                  }}
                  className="h-11 rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isGeocoding ? <Loader2 size={18} className="animate-spin" /> : <MapPinned size={18} />}
                  <span>Указать на карте</span>
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
                    {isPickedOnMap ? 'Точка на карте' : 'Нашли'}: <b>{placeLabel}</b>
                  </span>
                </p>
              )}
              {placeNotFound && !isGeocoding && (
                <p className="mt-2 p-3 rounded-zine-sm bg-zine-danger/10 text-sm2 text-zine-ink">
                  Не нашли такой адрес. Напиши улицу и номер дома, например «Юрово-Завальная 15», или нажми «Указать на карте» и тапни нужное место.
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
                      setIsPickedOnMap(false);
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

            {!hasNativeSubmit && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 rounded-zine-sm bg-zine-terracotta active:bg-zine-terracottaHover text-white text-lead font-bold flex items-center justify-center gap-2 shadow-zine-sm active:scale-[0.99] transition-transform cursor-pointer"
              >
                {isSubmitting ? <Loader2 size={22} className="animate-spin" /> : editingEventId ? 'Сохранить' : 'Опубликовать'}
              </button>
            )}
          </form>
        </BottomSheet>
      )}

      {isMapPickerOpen && (
        <MapPicker
          initial={customCoords}
          onClose={() => setIsMapPickerOpen(false)}
          onPick={(coords, address) => {
            setIsMapPickerOpen(false);
            setCustomCoords(coords);
            setPlaceLabel(address || 'точка отмечена');
            setPlaceNotFound(false);
            setIsPickedOnMap(true);
            setFormError(null);
            // Пустое поле заполняем найденным адресом; своё описание места не трогаем
            if (!locationName.trim() || !isPickedOnMap) setLocationName(address || 'Точка на карте');
          }}
        />
      )}
    </div>
  );
};

// Фон карточки по категории — у сходок нет фото
const REEL_BG: Record<EventCategory, string> = {
  walk: 'from-[#C2603F] to-[#3A2620]',
  cafe_bar: 'from-[#C9973A] to-[#3B2C1A]',
  expo_cinema: 'from-[#7C4A6E] to-[#2A1D27]',
  trip_outdoors: 'from-[#5B7B68] to-[#1F2A23]',
  boardgames: 'from-[#4A7396] to-[#1C2732]',
  sport: 'from-[#3F8A8C] to-[#1A2B2C]',
  support: 'from-[#9A7BA8] to-[#2A2230]',
  other: 'from-[#C77D86] to-[#33222A]'
};

/**
 * Сходка как Reels: на весь экран, кнопки справа, текст внизу
 */
const EventReel: React.FC<{
  event: AppEvent;
  isFirst: boolean;
  isCreator: boolean;
  isJoining: boolean;
  isDeleting: boolean;
  onJoin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenDetails: () => void;
  onNotInterested: () => void;
}> = ({ event: ev, isFirst, isCreator, isJoining, isDeleting, onJoin, onEdit, onDelete, onOpenDetails, onNotInterested }) => {
  const cat = eventCategoryOf(ev);
  const isFull = !ev.isJoined && Boolean(ev.maxParticipants) && (ev.participantsCount || 1) >= ev.maxParticipants;
  const people = (ev.participants || []).slice(0, 4);

  return (
    <SwipeReel
      className={`bg-gradient-to-br ${REEL_BG[ev.category] || REEL_BG.walk}`}
      rightLabel="Подробнее"
      rightBehavior="stay"
      leftLabel={isCreator || ev.isJoined ? undefined : 'Неинтересно'}
      leftBehavior="remove"
      onSwipe={(dir) => (dir === 'right' ? onOpenDetails() : onNotInterested())}
    >
      {/* Большой значок категории вместо фото */}
      <div className="absolute inset-x-0 top-[30%] flex justify-center text-[110px] leading-none select-none pointer-events-none">{cat.emoji}</div>

      {/* Справа — только «Позвать»; маршрут и жалоба — в подробностях */}
      <div className="absolute right-3 bottom-40 z-20 flex flex-col items-center gap-4 text-white">
        <button
          onClick={() => {
            telegramService.haptic('selection');
            telegramService.shareEvent(ev);
          }}
          aria-label="Позвать друзей"
          className="flex flex-col items-center gap-1 cursor-pointer"
        >
          <span className="w-12 h-12 rounded-full bg-black/35 backdrop-blur flex items-center justify-center">
            <Share2 size={22} />
          </span>
          <span className="text-cap font-semibold drop-shadow">Позвать</span>
        </button>
      </div>

      {/* Текст внизу на затемнении; нажатие мимо кнопок — подробности */}
      <div
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) onOpenDetails();
        }}
        className="absolute inset-x-0 bottom-0 z-10 px-4 pt-24 pb-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent text-white cursor-pointer"
      >
        {/* Одна строка-подпись: от ДА! МИНСК · категория · пометки значками */}
        <p className="pr-16 text-sm2 font-semibold text-white/85 flex items-center gap-x-2 whitespace-nowrap overflow-hidden">
          {ev.isOfficial && (
            <>
              <span className="text-[#FFD9A8]">⭐ ДА! МИНСК</span>
              <span className="text-white/40">·</span>
            </>
          )}
          <span className="truncate">
            {cat.emoji} {cat.label}
          </span>
          {(ev.tags || []).length > 0 && (
            <>
              <span className="text-white/40">·</span>
              <span aria-label={(ev.tags || []).map((t) => EVENT_TAGS[t].label).join(', ')}>{(ev.tags || []).map((t) => EVENT_TAGS[t].emoji).join(' ')}</span>
            </>
          )}
        </p>
        <h2 className="mt-1 pr-16 font-serif font-bold text-display leading-tight line-clamp-2">{ev.title}</h2>
        <p className="mt-1.5 pr-16 text-body font-semibold">{formatEventDate(ev.dateTime)}</p>
        <p className="pr-16 text-sm2 text-white/80 truncate">📍 {ev.locationName}</p>

        <div className="mt-3 flex items-center gap-3">
          {isCreator ? (
            // Своя сходка: организатор и так идёт — вместо «Я иду» управление
            <>
              <button
                onClick={onEdit}
                className="h-12 px-5 rounded-full bg-white text-[#2B2623] text-body font-bold inline-flex items-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <Edit2 size={19} />
                <span>Изменить</span>
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                aria-label="Удалить сходку"
                className="w-12 h-12 shrink-0 rounded-full bg-white/15 backdrop-blur text-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              >
                {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
              </button>
            </>
          ) : (
            <button
              onClick={onJoin}
              disabled={isJoining || isFull}
              className={`h-12 px-6 shrink-0 rounded-full text-body font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${
                ev.isJoined ? 'bg-zine-sage text-white' : isFull ? 'bg-white/25 text-white/80 cursor-default' : 'bg-white text-[#2B2623]'
              }`}
            >
              {isFull ? (
                'Мест нет'
              ) : isJoining ? (
                <Loader2 size={20} className="animate-spin" />
              ) : ev.isJoined ? (
                <>
                  <Check size={20} strokeWidth={3} />
                  <span>Я иду{ev.myGuests ? ` +${ev.myGuests}` : ''}{ev.myWithKids ? ' 👶' : ''}</span>
                </>
              ) : (
                'Пойду!'
              )}
            </button>
          )}
          {/* Кто идёт: лица и сколько */}
          <span className="min-w-0 flex items-center gap-2">
            <span className="flex -space-x-2 shrink-0">
              {(people.length ? people.slice(0, 3) : [ev.creator]).map((p, i) => (
                <img
                  key={`${p?.telegramId}-${i}`}
                  src={p?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border-2 border-black/40"
                />
              ))}
            </span>
            <span className="text-sm2 text-white/85 whitespace-nowrap">
              {ev.participantsCount || 1}
              {ev.maxParticipants ? ` из ${ev.maxParticipants}` : ''}
            </span>
          </span>
        </div>
      </div>

      {/* Подсказка про свайпы — только на первой карточке */}
      {isFirst && <SwipeHint left={isCreator || ev.isJoined ? undefined : 'неинтересно'} right="подробнее" className="top-44" />}
    </SwipeReel>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block mb-2 text-body font-bold text-zine-ink">{label}</label>
    {children}
  </div>
);

export default EventsScreen;
