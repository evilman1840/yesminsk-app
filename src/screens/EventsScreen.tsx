import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { thumb } from '../utils/thumb';
import { Plus, Check, Loader2, Edit2, Trash2, Navigation, MapPinned, Share2, ChevronRight, EyeOff } from 'lucide-react';
import { AppEvent, EventCategory, EVENT_CATEGORIES_CONFIG, eventCategoryOf, EventTag, EVENT_TAGS, JoinOptions, EventWhen, EVENT_WHEN, matchesWhen, EventPayload, EventTemplate, TemplateField, CUSTOM_TEMPLATE, SUPPORT_RULES, MeetupCreateRequest, MeetupPlace, MeetupFormSource, PlaceItem, WishSummaryItem } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';
import { BottomSheet } from '../components/ui/BottomSheet';
import { formatEventDate } from './MapScreen';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { MapPicker } from '../components/common/MapPicker';
import { EventDetails, plural } from '../components/common/EventDetails';
import { JoinSheet } from '../components/common/JoinSheet';
import { formatDistance } from '../components/common/UserBottomSheet';
import { loadSeenEvents, markEventSeen } from '../utils/seenEvents';
import { UndoToast } from '../components/ui/UndoToast';
import { useClosingConfirmation, useMainButton } from '../hooks/useTelegram';
import { HelpLine } from '../components/common/HelpLine';
import { PhotoPicker, PickedPhoto, photoFromUrl, photoSrc } from '../components/common/PhotoPicker';
import { PHOTO_TEXTS } from '../texts/photos';
import { WishSheet } from '../components/common/WishSheet';
import { InfoToast } from '../components/ui/InfoToast';
import { WISH_TEXTS } from '../texts/wishes';
import { MEETUP_TEXTS as M, priceLabel } from '../texts/meetups';
import { confirmAttendance } from '../context/eventUpdates';
import { templateTitle, templateDescription, defaultExtras, templatesForPlace, quickTimes, toLocalInput, eventTemplateEmoji, quickTimeFromParam } from '../utils/meetupTemplates';

import { cachedTemplates, loadTemplates } from '../utils/templatesStore';

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
  onCreateEvent?: (eventData: EventPayload) => Promise<any>;
  onUpdateEvent?: (eventId: string, eventData: EventPayload) => Promise<any>;
  onDeleteEvent?: (eventId: string) => Promise<any> | void;
  // options — с кем идёшь; null — «Не пойду». Вернёт обновлённую сходку или null
  onJoin?: (event: AppEvent, options: JoinOptions | null) => Promise<AppEvent | null>;
  onRefreshEvents?: () => void;
  // Открыть форму уже заполненной: «Сходка сюда» из карточки места, ссылка из бота или поста
  initialCreate?: MeetupCreateRequest | null;
  onInitialCreateUsed?: () => void;
  places?: PlaceItem[]; // для «Хочу сходить»: выбор места
  initialWish?: { placeId?: string } | null; // открыть «Хочу сходить» сразу (из сообщения бота)
  onInitialWishUsed?: () => void;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  events,
  currentUserId: propUserId,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onJoin,
  onRefreshEvents,
  initialCreate,
  onInitialCreateUsed,
  places = [],
  initialWish,
  onInitialWishUsed
}) => {
  const currentTgUser = telegramService.getUser();
  const currentUserId = propUserId || currentTgUser?.id;

  // 'kids' — «👶 С детьми»: сходки, куда можно с детьми
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all' | 'kids'>('all');
  const [eventWhen, setEventWhen] = useState<EventWhen>('all'); // сегодня / завтра / выходные
  const [onlyMine, setOnlyMine] = useState(false); // «⭐ Мои»: собираю или иду
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailsEventId, setDetailsEventId] = useState<string | null>(null);
  const [, setHiddenVersion] = useState(0); // перерисовать после «Неинтересно»
  // Уже пролистанные сходки — в конец ленты. Список берём при открытии, чтобы карточки не прыгали, пока листаешь
  const [seenAtOpen] = useState<Set<string>>(() => loadSeenEvents());
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
  const [seatsBumped, setSeatsBumped] = useState(false);
  const [tags, setTags] = useState<EventTag[]>([]);
  // Сходка из карточки места — тогда напишем тем, кто его сохранил
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [joinEventId, setJoinEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Шаблоны: сначала выбор идеи, потом заполненная форма
  const [templates, setTemplates] = useState<EventTemplate[] | null>(cachedTemplates());
  const [formStep, setFormStep] = useState<'pick' | 'form'>('pick');
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [pickPlaceType, setPickPlaceType] = useState<string | undefined>(undefined);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  // Цена: по умолчанию бесплатно
  const [isPaid, setIsPaid] = useState(false);
  // «Соберу я» из «Хочу сходить»: после публикации бот напишет остальным
  const [wishGroupId, setWishGroupId] = useState<string | null>(null);
  // «Хочу сходить»: плашка в ленте и шторка
  const [isWishOpen, setIsWishOpen] = useState(false);
  const [wishToast, setWishToast] = useState<number | null>(null); // отметили желание: сколько ещё людей хотят того же
  const [wishPlace, setWishPlace] = useState<PlaceItem | null>(null);
  useEffect(() => {
    if (!initialWish) return;
    setWishPlace((initialWish.placeId && places.find((p) => p.id === initialWish.placeId)) || null);
    setIsWishOpen(true);
    onInitialWishUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWish]);
  const [wishSummary, setWishSummary] = useState<WishSummaryItem[]>([]);
  const [myWishCount, setMyWishCount] = useState(0);
  const refreshWishes = () =>
    api
      .getWishes()
      .then((r) => {
        setWishSummary(r.summary || []);
        setMyWishCount((r.mine || []).length);
      })
      .catch(() => {});
  useEffect(() => {
    refreshWishes();
  }, []);
  const topWish = wishSummary.filter((s) => !s.includesMe).sort((a, b) => b.count - a.count)[0];
  const [price, setPrice] = useState('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  // Последние название и описание, которые заполнил шаблон: пока человек их не правил, обновляем вместе с полями
  const autoText = useRef<{ title: string; description: string }>({ title: '', description: '' });
  const template = templates?.find((t) => t.key === templateKey) || null;
  const isTemplateForm = Boolean(template && template.key !== CUSTOM_TEMPLATE);

  useEffect(() => {
    if (!templates) loadTemplates().then(setTemplates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  // «Опубликовать» — нативная MainButton; requestSubmit запускает и проверку required-полей
  const hasNativeSubmit = useMainButton({
    text: editingEventId ? 'Сохранить' : 'Опубликовать',
    onClick: () => formRef.current?.requestSubmit(),
    loading: isSubmitting,
    active: isModalOpen && !isMapPickerOpen && formStep === 'form'
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
  )
    .filter((e) => !notInterestedEvents.has(String(e.id)) && matchesWhen(e.dateTime, eventWhen))
    // «⭐ Мои»: что я собираю и куда иду. Во «Все» своих не показываем — они в «Мои»
    .filter((e) => {
      const mine = Number(e.creator?.telegramId) === Number(currentUserId);
      // Во «Все» начавшиеся больше получаса назад не показываем — они остаются в «Мои»
      return onlyMine ? e.isJoined || mine : !mine && new Date(e.dateTime).getTime() > Date.now() - 30 * 60 * 1000;
    })
    // Во «Все»: сначала новые для меня, потом уже пролистанные, в конце — куда я уже записан
    .map((e, i) => ({ e, i, rank: onlyMine ? 0 : e.isJoined ? 2 : seenAtOpen.has(String(e.id)) ? 1 : 0 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ e }) => e);
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

  // Одно открытие формы — для воронки «открыли → выбрали идею → опубликовали»
  const formSession = useRef<{ id: string; done: boolean } | null>(null);
  const track = (
    step: 'opened' | 'template' | 'published' | 'closed' | 'error',
    extra: { template?: string; source?: MeetupFormSource; closedAt?: 'pick' | 'form'; missing?: string[]; error?: string } = {}
  ) => {
    if (formSession.current) api.trackMeetupForm({ sessionId: formSession.current.id, step, ...extra });
  };
  // Места из «Мест» для подсказок в поле «Где встречаемся?»: сначала подходящие по типу шаблону, потом остальные
  const placeHints = (() => {
    const types = template && template.key !== CUSTOM_TEMPLATE ? template.placeTypes : [];
    // У шаблона есть типы мест (кофе → кафе) — только подходящие; парки для кофе не предлагаем
    const matching = types.length ? places.filter((p) => types.includes(p.category)) : [];
    // Подходящих нет — лучшие места, чтобы ряд не был пустым
    if (matching.length) return matching.slice(0, 8);
    return [...places].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8);
  })();
  // Один ряд кнопок: места из «Мест» (с placeId), за ними популярные точки Минска
  const placeChips = [
    ...placeHints.map((p) => ({ key: `p-${p.id}`, placeId: p.id as string | null, name: p.name, text: p.address && p.address !== p.name ? `${p.name}, ${p.address}` : p.name, coords: p.coordinates })),
    ...MINSK_SPOTS_PRESETS.slice(0, 6)
      .filter((spot) => !placeHints.some((p) => p.name === spot.name))
      .map((spot) => ({ key: `s-${spot.name}`, placeId: null as string | null, name: spot.name, text: spot.name, coords: spot.coords }))
  ];

  // Какие обязательные поля пустые — для подсказки и воронки
  const missingFields = () => {
    const list: string[] = [];
    if (!title.trim()) list.push('title');
    if (!description.trim()) list.push('description');
    if (!locationName.trim()) list.push('place');
    if (!dateTime) list.push('time');
    if (template?.fields.some((f) => f.required && !extras[f.key])) list.push('templateField');
    return list;
  };

  const closeModal = () => {
    // Закрыли новую сходку, не опубликовав: где именно
    if (!editingEventId && formSession.current && !formSession.current.done) track('closed', { closedAt: formStep, missing: formStep === 'form' ? missingFields() : undefined });
    formSession.current = null;
    setIsModalOpen(false);
  };

  const handleOpenCreateModal = (presetCategory?: EventCategory, place?: MeetupPlace, source: MeetupFormSource = 'feed') => {
    formSession.current = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, done: false };
    track('opened', { source });
    setPlaceId(place?.placeId || null);
    setPickPlaceType(place?.placeType);
    setTemplateKey(null);
    setExtras({});
    setDurationMinutes(0);
    setPhotos([]);
    setIsPhotoUploading(false);
    setIsPaid(false);
    setPrice('');
    setWishGroupId(null);
    // Шаблоны не загрузились — сразу обычная форма
    setFormStep(templates && templates.length ? 'pick' : 'form');
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
    // По умолчанию — завтра вечером; быстрые кнопки рядом
    setDateTime(toLocalInput(quickTimes().find((q) => q.id === 'tomorrowEvening')!.date));
    setMaxParticipants('0');
    setTags([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Пришли из карточки места или по ссылке — открываем форму; если указан шаблон и время, сразу заполняем
  useEffect(() => {
    if (!initialCreate || !templates) return;
    handleOpenCreateModal(undefined, initialCreate.place, initialCreate.source || 'place');
    const tpl = initialCreate.template ? templates.find((t) => t.key === initialCreate.template) : null;
    if (tpl) {
      // Вид спорта из ссылки — в первое обязательное поле-выбор
      const sub = initialCreate.opt ? tpl.fields.find((f) => f.type === 'select' && f.required && f.options?.some((o) => o.value === initialCreate.opt)) : null;
      applyTemplate(tpl, sub ? { [sub.key]: initialCreate.opt! } : undefined);
    }
    if (initialCreate.wishGroupId) setWishGroupId(initialCreate.wishGroupId);
    const when = quickTimeFromParam(initialCreate.when);
    if (when) setDateTime(toLocalInput(when));
    onInitialCreateUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCreate, templates]);

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
    // Время — в местном часовом поясе (раньше уходило по UTC, и при сохранении сдвигалось на 3 часа)
    const d = new Date(ev.dateTime);
    setDateTime(Number.isNaN(d.getTime()) ? '' : toLocalInput(d));
    setMaxParticipants(String(ev.maxParticipants || 0));
    setTags(ev.tags || []);
    setTemplateKey(ev.templateId || null);
    setExtras(ev.extras || {});
    setDurationMinutes(ev.durationMinutes || 0);
    setPhotos((ev.photos || []).map(photoFromUrl));
    setIsPaid(Boolean(ev.isPaid));
    setPrice(ev.price ? String(ev.price).replace('.', ',') : '');
    setIsPhotoUploading(false);
    autoText.current = { title: ev.title || '', description: ev.description || '' };
    setFormStep('form');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Выбрали шаблон — заполняем форму за человека
  const applyTemplate = (tpl: EventTemplate, presetExtras?: Record<string, string>) => {
    telegramService.haptic('selection');
    if (!editingEventId) track('template', { template: tpl.key });
    setTemplateKey(tpl.key);
    setFormError(null);
    if (tpl.key === CUSTOM_TEMPLATE) {
      setExtras({});
      setDurationMinutes(0);
      setTitle('');
      setDescription('');
      setCategory('walk');
      setTags([]);
      setMaxParticipants('0');
      setIsPaid(false);
      setPrice('');
      autoText.current = { title: '', description: '' };
    } else {
      const ex = { ...defaultExtras(tpl), ...presetExtras };
      const nextTitle = templateTitle(tpl, ex);
      const nextDescription = templateDescription(tpl, ex);
      setExtras(ex);
      setTitle(nextTitle);
      setDescription(nextDescription);
      setCategory(tpl.category || 'other');
      setCustomCategory(tpl.category ? '' : tpl.name);
      setTags(tpl.tags || []);
      setMaxParticipants(String(tpl.seats || 0));
      setDurationMinutes(tpl.durationMinutes || 0);
      setIsPaid(Boolean(tpl.paid));
      setPrice('');
      autoText.current = { title: nextTitle, description: nextDescription };
    }
    setFormStep('form');
  };

  // Поменяли доп. поле (фильм, вид спорта, уровень): название и описание обновляем, если их не правили руками
  const updateExtra = (key: string, value: string) => {
    const next = { ...extras, [key]: value };
    if (!value) delete next[key];
    setExtras(next);
    if (!template) return;
    const nextTitle = templateTitle(template, next);
    const nextDescription = templateDescription(template, next);
    if (title === autoText.current.title) setTitle(nextTitle);
    if (description === autoText.current.description) setDescription(nextDescription);
    autoText.current = { title: nextTitle, description: nextDescription };
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
        setPlaceId(null);
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

  // Ошибка формы: показываем и записываем в воронку (чтобы понять, где бросают)
  const failForm = (text: string, error: string) => {
    setFormError(text);
    if (!editingEventId) track('error', { error, missing: missingFields() });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = missingFields().filter((f) => f !== 'templateField');
    if (missing.length) {
      failForm(M.missingFields(missing.map((f) => M.fieldNames[f]).join(', ')), 'required');
      return;
    }
    if (isPhotoUploading) {
      failForm(PHOTO_TEXTS.wait, 'photoWait');
      return;
    }
    const missingField = template?.fields.find((f) => f.required && (!extras[f.key] || (extras[f.key] === 'other' && f.allowCustom && !extras[`${f.key}Custom`])));
    if (missingField) {
      failForm(M.fieldRequired(missingField.label), 'templateField');
      return;
    }
    if (category === 'other' && !customCategory.trim()) {
      failForm(M.customCategoryRequired, 'customCategory');
      return;
    }

    setIsSubmitting(true);
    try {
      // Всегда определяем точные координаты по введенному адресу
      let resolvedCoords = customCoords;
      if (!resolvedCoords || resolvedCoords.length !== 2) {
        const found = await handleGeocodeAddress(locationName.trim());
        if (!found) {
          failForm(M.placeNotFound, 'geocode');
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
        maxParticipants: Number(maxParticipants) === 1 ? 2 : Number(maxParticipants) || 0,
        tags,
        ...(placeId && !editingEventId ? { placeId } : {}),
        ...(templateKey && !editingEventId ? { templateId: templateKey } : {}),
        ...(wishGroupId && !editingEventId ? { wishGroupId } : {}),
        durationMinutes,
        photos: photos.map((p) => p.id).filter(Boolean),
        isPaid,
        price: isPaid && price ? Number(price.replace(',', '.')) || undefined : undefined,
        // «Делим аренду» без суммы — просто не указываем
        ...(template?.fields.length ? { extras: Object.fromEntries(Object.entries(extras).filter(([, v]) => v && v !== 'split')) } : {})
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

      if (!editingEventId && formSession.current) {
        track('published', { template: templateKey || undefined });
        formSession.current.done = true;
      }
      closeModal();
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      failForm(err.message || M.saveFailed, 'server');
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
            onClick={() => handleOpenCreateModal(undefined, undefined, 'feed')}
            className="h-11 px-4 rounded-full bg-zine-terracotta active:bg-zine-terracottaHover text-white text-body font-bold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span>{M.createButtonShort}</span>
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
          <button
            onClick={() => {
              telegramService.haptic('selection');
              setOnlyMine((v) => !v);
            }}
            className={`h-9 px-3.5 shrink-0 rounded-full text-sm2 font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              onlyMine ? 'bg-zine-mustard text-[#2B2623]' : 'bg-black/35 backdrop-blur text-white border border-white/20'
            }`}
          >
            {M.mineChip}
          </button>
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

        {/* «Хочу сходить»: нет подходящей сходки — отметь, куда хочется */}
        <div className="px-4 mt-2">
          <button
            onClick={() => {
              telegramService.haptic('selection');
              setIsWishOpen(true);
            }}
            className="w-full p-2 pr-3 rounded-zine-sm bg-black/40 backdrop-blur border border-white/20 text-white text-left flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <span className="w-10 h-10 shrink-0 rounded-full bg-zine-terracotta flex items-center justify-center text-[20px] leading-none">🙋</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm2 font-bold">{WISH_TEXTS.barTitle}</span>
              <span className="block text-cap text-white/80 line-clamp-2">
                {topWish ? WISH_TEXTS.barCounter(topWish.count, topWish.what, topWish.when) : myWishCount ? WISH_TEXTS.barMine(myWishCount) : WISH_TEXTS.barPrompt}
              </span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-white/70" />
          </button>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 text-white">
          <div className="text-[48px] mb-3">🗓</div>
          <p className="font-serif font-bold text-title">{onlyMine ? M.mineEmptyTitle : M.emptyTitle}</p>
          <p className="mt-2 text-body text-white/70">{onlyMine ? M.mineEmptyText : M.emptyText}</p>
          <button
            onClick={() => {
              handleOpenCreateModal(selectedCategory === 'all' || selectedCategory === 'kids' ? undefined : selectedCategory, undefined, 'empty');
              if (selectedCategory === 'kids') setTags(['kids']);
            }}
            className="mt-5 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer"
          >
            {M.createButton}
          </button>
          <button
            onClick={() => setIsWishOpen(true)}
            className="mt-3 h-12 px-6 rounded-full bg-white/15 text-white text-body font-semibold cursor-pointer"
          >
            {WISH_TEXTS.emptyWant}
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
                emoji={eventTemplateEmoji(ev, templates)}
                isFirst={index === 0}
                isCreator={isCreator}
                isJoining={joiningId === String(ev.id)}
                isDeleting={deletingId === String(ev.id)}
                onJoin={() => setJoinEventId(String(ev.id))}
                onLeave={async () => {
                  if (!(await telegramService.confirm(M.notGoingConfirm(ev.title), { okText: M.notGoingOk, destructive: true }))) return;
                  handleJoin(ev, null);
                }}
                onEdit={() => handleOpenEditModal(ev)}
                onDelete={() => handleDeleteEvent(ev)}
                onOpenDetails={() => setDetailsEventId(String(ev.id))}
                onSeen={() => markEventSeen(String(ev.id))}
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
          topClass="top-[244px]"
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

      {/* Создание / редактирование сходки: сначала выбор идеи, потом заполненная форма */}
      {isModalOpen && formStep === 'pick' && templates && (
        <BottomSheet title={M.pickTitle} onClose={closeModal}>
          <p className="text-body text-zine-inkMuted">{M.pickHint}</p>
          {placeLabel && <p className="mt-2 text-sm2 font-semibold text-zine-ink truncate">📍 {M.pickForPlace(placeLabel)}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {templatesForPlace(templates, pickPlaceType)
              .filter((t) => t.key !== CUSTOM_TEMPLATE)
              .map((t) => (
                <button
                  type="button"
                  key={t.key}
                  onClick={() => applyTemplate(t)}
                  className="min-h-[104px] p-3 rounded-zine-sm bg-zine-card text-left flex flex-col gap-1.5 active:scale-[0.97] transition-transform cursor-pointer"
                >
                  <span className="text-[30px] leading-none">{t.emoji}</span>
                  <span className="text-body font-bold text-zine-ink leading-tight">{t.name}</span>
                  <span className="mt-auto text-cap text-zine-inkMuted">
                    {[t.seats ? `${t.seats} ${plural(t.seats, 'место', 'места', 'мест')}` : '', t.durationMinutes ? M.duration(t.durationMinutes) : ''].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
          </div>
          {templates
            .filter((t) => t.key === CUSTOM_TEMPLATE)
            .map((t) => (
              <button
                type="button"
                key={t.key}
                onClick={() => applyTemplate(t)}
                className="mt-2 w-full p-3 rounded-zine-sm border-2 border-dashed border-zine-border flex items-center gap-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
              >
                <span className="text-[26px] leading-none">{t.emoji}</span>
                <span>
                  <span className="block text-body font-bold text-zine-ink">{t.name}</span>
                  <span className="block text-cap text-zine-inkMuted">{M.customHint}</span>
                </span>
              </button>
            ))}
        </BottomSheet>
      )}

      {isModalOpen && formStep === 'form' && (
        <BottomSheet title={editingEventId ? M.editMeetup : M.newMeetup} onClose={closeModal}>
          {/* noValidate: вместо всплывашек браузера (в Telegram их часто не видно) — наша подсказка, что именно не заполнено */}
          <form ref={formRef} onSubmit={handleSubmitForm} noValidate className="space-y-5">
            {formError && (
              <div ref={formErrorRef} className="p-3 rounded-zine-sm bg-zine-danger/10 text-zine-danger text-sm2 font-semibold">{formError}</div>
            )}

            {/* Выбранный шаблон — можно сменить */}
            {!editingEventId && template && templates && templates.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-zine-sm bg-zine-card">
                <span className="text-[26px] leading-none">{template.emoji}</span>
                <span className="flex-1 min-w-0 text-body font-bold text-zine-ink truncate">{template.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    telegramService.haptic('selection');
                    setFormStep('pick');
                  }}
                  className="h-9 px-3.5 shrink-0 rounded-full bg-zine-cardElevated text-sm2 font-semibold text-zine-terracotta cursor-pointer"
                >
                  {M.changeTemplate}
                </button>
              </div>
            )}

            <Field label={M.whenLabel}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-2">
                {quickTimes().map((q) => {
                  const value = toLocalInput(q.date);
                  return (
                    <button
                      type="button"
                      key={q.id}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setDateTime(value);
                      }}
                      className={`h-10 px-3.5 shrink-0 rounded-full border-2 text-sm2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        dateTime === value ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                      }`}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="field"
                required
              />
            </Field>

            <Field label="Где встречаемся?">
              {/* Сначала готовые места — одним нажатием, без ввода адреса: подходящие из «Мест», потом популярные точки Минска */}
              <p className="mb-2 p-3 rounded-zine-sm bg-zine-terracotta/10 text-sm2 text-zine-ink">⚖️ {M.legalVenueHint}</p>
              <p className="mb-1.5 text-cap font-semibold text-zine-inkMuted">{M.pickPlaceHint}</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-3">
                {placeChips.map((chip) => {
                  const active = chip.placeId ? placeId === chip.placeId : !placeId && locationName === chip.name;
                  return (
                    <button
                      type="button"
                      key={chip.key}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setLocationName(chip.text);
                        setCustomCoords(chip.coords);
                        setPlaceLabel(chip.name);
                        setPlaceNotFound(false);
                        setIsPickedOnMap(Boolean(chip.placeId));
                        setPlaceId(chip.placeId);
                        setFormError(null);
                      }}
                      className={`h-10 px-3.5 shrink-0 rounded-full border-2 text-sm2 whitespace-nowrap cursor-pointer transition-colors ${
                        active ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta font-semibold' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                      }`}
                    >
                      {chip.placeId ? '📍 ' : ''}{chip.name}
                    </button>
                  );
                })}
              </div>

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
                  setPlaceId(null);
                }}
                onBlur={() => {
                  if (locationName.trim() && !customCoords) {
                    handleGeocodeAddress(locationName.trim());
                  }
                }}
                placeholder={M.addressPlaceholder}
                className={`field ${formError && !locationName.trim() ? 'ring-2 ring-zine-danger/60' : ''}`}
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
            </Field>

            {/* Доп. поля шаблона: фильм, вид спорта, уровень, что взять, стоимость */}
            {template?.fields.map((field) => (
              <TemplateFieldInput key={field.key} field={field} extras={extras} onChange={updateExtra} />
            ))}

            <Field label="Как назовём?">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Прогулка по Осмоловке с кофе"
                className={`field ${formError && !title.trim() ? 'ring-2 ring-zine-danger/60' : ''}`}
                required
              />
            </Field>

            {!isTemplateForm && (
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
                    Своя идея: впиши свою
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
            )}

            <Field label="Пару слов о встрече">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Какой план, кого ждём, что взять с собой"
                className={`field ${formError && !description.trim() ? 'ring-2 ring-zine-danger/60' : ''}`}
                required
              />
            </Field>

            <Field label={PHOTO_TEXTS.eventLabel}>
              <PhotoPicker value={photos} onChange={setPhotos} onBusyChange={setIsPhotoUploading} />
              <p className="mt-1.5 text-cap text-zine-inkMuted">{PHOTO_TEXTS.eventHint(5)}</p>
            </Field>

            {/* «Поныть»: правила встречи и телефон доверия подключаются сами */}
            {category === 'support' && (
              <div className="p-4 rounded-zine-sm bg-zine-blush/15">
                <p className="text-body font-bold text-zine-ink">{M.supportRulesTitle}</p>
                <ul className="mt-1.5 space-y-1">
                  {SUPPORT_RULES.map((r) => (
                    <li key={r} className="text-sm2 text-zine-ink">
                      • {r}
                    </li>
                  ))}
                </ul>
                {tags.includes('empaths') && <p className="mt-2 text-sm2 text-zine-inkMuted">🫶 {M.empathsDefaultHint}</p>}
                <HelpLine className="mt-3" />
              </div>
            )}

            <Field label="Сколько мест?">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxParticipants === '0' ? '' : maxParticipants}
                  onChange={(e) => setMaxParticipants(String(Math.max(0, Math.floor(Number(e.target.value) || 0))))}
                  // 1 место — сходка сразу полная: организатор занимает его сам
                  onBlur={() => maxParticipants === '1' && (setMaxParticipants('2'), setSeatsBumped(true))}
                  placeholder="Без ограничений"
                  className="field flex-1"
                />
              </div>
              <p className="mt-1.5 text-cap text-zine-inkMuted">Вместе с тобой и гостями участников. Пусто: сколько угодно</p>
              {seatsBumped && <p className="mt-1.5 text-cap font-semibold text-zine-terracotta">{M.seatsMinTwo}</p>}
              {template?.fields.some((f) => f.options?.some((o) => o.seatsHint && o.value === extras[f.key])) && (
                <p className="mt-1.5 text-cap font-semibold text-zine-ink">💡 {M.seatsHintPair}</p>
              )}
            </Field>

            <Field label={M.priceLabel}>
              <div className="flex gap-2">
                {[false, true].map((paid) => (
                  <button
                    type="button"
                    key={String(paid)}
                    onClick={() => {
                      telegramService.haptic('selection');
                      setIsPaid(paid);
                    }}
                    className={`h-11 px-4 rounded-full border-2 text-sm2 font-semibold cursor-pointer transition-colors ${
                      isPaid === paid ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                    }`}
                  >
                    {paid ? M.pricePaid : M.priceFree}
                  </button>
                ))}
              </div>
              {isPaid && (
                <>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
                    placeholder={M.priceAmountPlaceholder}
                    className="field mt-2"
                  />
                  <p className="mt-1.5 text-cap text-zine-inkMuted">{M.priceHint}</p>
                </>
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

      {isWishOpen && (
        <WishSheet
          places={places}
          presetPlace={wishPlace}
          onClose={() => {
            setIsWishOpen(false);
            setWishPlace(null);
            refreshWishes();
          }}
          onChanged={refreshWishes}
          onCreated={(sameCount) => {
            setIsWishOpen(false);
            setWishPlace(null);
            setWishToast(sameCount);
          }}
        />
      )}
      {wishToast !== null && (
        <InfoToast
          title={WISH_TEXTS.toastTitle}
          text={[WISH_TEXTS.toastText, wishToast > 0 ? WISH_TEXTS.sameCount(wishToast) : ''].filter(Boolean).join(' ')}
          onDone={() => setWishToast(null)}
        />
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
            setPlaceId(null);
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
  onLeave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenDetails: () => void;
  onNotInterested: () => void;
  onSeen?: () => void;
  emoji?: string | null;
}> = ({ event: ev, isFirst, isCreator, isJoining, isDeleting, onJoin, onLeave, onEdit, onDelete, onOpenDetails, onNotInterested, onSeen, emoji }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  // Карточка видна больше секунды — считаем просмотренной
  const reelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = reelRef.current;
    if (!el || !onSeen) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) timer = window.setTimeout(onSeen, 1200);
        else window.clearTimeout(timer);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cat = eventCategoryOf(ev);
  const isFull = !ev.isJoined && Boolean(ev.maxParticipants) && (ev.participantsCount || 1) >= ev.maxParticipants;
  // Все, кто идёт; если сервер ещё старый и прислал не всех — хотя бы организатор
  const people = ev.participants?.length ? ev.participants : [ev.creator];

  return (
    <SwipeReel
      className={`bg-gradient-to-br ${REEL_BG[ev.category] || REEL_BG.walk}`}
      rightLabel="Подробнее"
      rightBehavior="stay"
      leftLabel={isCreator || ev.isJoined ? undefined : 'Неинтересно'}
      leftBehavior="remove"
      onSwipe={(dir) => (dir === 'right' ? onOpenDetails() : onNotInterested())}
    >
      {/* Обложка: первое фото сходки; без фото значок стоит над названием (внизу), чтобы не наезжать на шапку */}
      {ev.photos?.length ? (
        <>
          <img src={photoSrc(ev.photos[0])} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
        </>
      ) : null}

      <div ref={reelRef} className="absolute inset-0 pointer-events-none" aria-hidden />
      {/* Справа — «Позвать» и «Неинтересно»; маршрут и жалоба — в подробностях */}
      <div className="absolute right-3 bottom-40 z-20 flex flex-col items-center gap-4 text-white">
        {!isCreator && !ev.isJoined && (
          <button
            onClick={() => {
              telegramService.haptic('selection');
              onNotInterested();
            }}
            aria-label="Неинтересно"
            className="flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className="w-12 h-12 rounded-full bg-black/35 backdrop-blur flex items-center justify-center">
              <EyeOff size={22} />
            </span>
            <span className="text-cap font-semibold drop-shadow">Неинтересно</span>
          </button>
        )}
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
        {isFirst && (
          <div>
            <SwipeHint inline left={isCreator || ev.isJoined ? undefined : 'неинтересно'} right="подробнее" />
          </div>
        )}
        {!ev.photos?.length && <div className="mb-3 text-[72px] leading-none select-none pointer-events-none">{emoji || cat.emoji}</div>}
        {/* Одна строка-подпись: от ГУЛЯЙ! · категория · пометки значками */}
        <p className="pr-16 text-sm2 font-semibold text-white/85 flex items-center gap-x-2 whitespace-nowrap overflow-hidden">
          {ev.isOfficial && (
            <>
              <span className="text-[#FFD9A8]">⭐ Рекомендуем</span>
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
        <p className="mt-1.5 pr-16 text-body font-semibold">
          {formatEventDate(ev.dateTime)}
          {ev.durationMinutes ? <span className="font-normal text-white/75"> · {M.duration(ev.durationMinutes)}</span> : null}
        </p>
        <p className="pr-16 flex text-sm2 text-white/80">
          <span className="truncate">📍 {ev.locationName}</span>
          {formatDistance(ev.distanceMeters) && <span className="shrink-0">&nbsp;· {formatDistance(ev.distanceMeters)}</span>}
        </p>
        {/* Цена и метки шаблона: «💚 Бесплатно», «🏓 Настольный теннис · любой уровень» */}
        <div data-no-swipe className="mt-2 -mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar fade-right">
          {[priceLabel(ev), ...(ev.badges || [])].map((b) => (
            <span key={b} className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full bg-white/20 backdrop-blur text-sm2 font-semibold flex items-center">
              {b}
            </span>
          ))}
        </div>

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
          <span className="min-w-0 flex-1 flex items-center gap-2">
            {/* Лица всех участников; много — ряд листается пальцем (не свайпает карточку) */}
            <span data-no-swipe className={`min-w-0 flex -space-x-2 overflow-x-auto no-scrollbar py-0.5 ${people.length > 5 ? 'fade-right pr-3' : ''}`}>
              {people.map((p, i) => (
                <img
                  key={`${p?.telegramId}-${i}`}
                  src={thumb(p?.avatarUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt=""
                  loading="lazy"
                  className={`w-8 h-8 shrink-0 rounded-full object-cover border-2 ${p && 'confirmed' in p && p.confirmed ? 'border-zine-sage' : 'border-black/40'}`}
                />
              ))}
            </span>
            <span className="shrink-0 text-sm2 text-white/85 whitespace-nowrap">
              {ev.participantsCount || 1}
              {ev.maxParticipants ? ` из ${ev.maxParticipants}` : ''}
            </span>
          </span>
        </div>
        {/* Записан(а) — «Точно приду» и заметная отмена прямо на карточке */}
        {ev.isJoined && !isCreator && (
          <div className="mt-2 flex items-center gap-4">
            {!ev.myConfirmed && (
              <button
                onClick={async () => {
                  setIsConfirming(true);
                  await confirmAttendance(ev);
                  setIsConfirming(false);
                }}
                disabled={isConfirming}
                className="h-9 px-4 rounded-full bg-zine-sage text-white text-sm2 font-bold flex items-center cursor-pointer active:scale-[0.98] transition-transform"
              >
                {isConfirming ? <Loader2 size={16} className="animate-spin" /> : M.confirmGo}
              </button>
            )}
            <button
              onClick={onLeave}
              disabled={isJoining}
              className="h-9 text-body font-bold text-white underline underline-offset-4 decoration-white/70 cursor-pointer"
            >
              {M.notGoing}
            </button>
          </div>
        )}
      </div>

      {/* Подсказка про свайпы — только на первой карточке */}
    </SwipeReel>
  );
};

// Доп. поле шаблона: выбор вариантов, текст или сумма
const TemplateFieldInput: React.FC<{ field: TemplateField; extras: Record<string, string>; onChange: (key: string, value: string) => void }> = ({
  field,
  extras,
  onChange
}) => {
  const value = extras[field.key] || '';
  const chip = (isOn: boolean) =>
    `h-10 px-3.5 rounded-full border-2 text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
      isOn ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
    }`;
  const pick = (v: string) => {
    telegramService.haptic('selection');
    onChange(field.key, v);
  };

  return (
    <Field label={field.label}>
      {field.type === 'select' && (
        <>
          <div className="flex flex-wrap gap-2">
            {field.options?.map((o) => (
              <button type="button" key={o.value} onClick={() => pick(o.value)} className={chip(value === o.value)}>
                {o.emoji && <span>{o.emoji}</span>}
                {o.label}
              </button>
            ))}
          </div>
          {value === 'other' && field.allowCustom && (
            <input
              type="text"
              value={extras[`${field.key}Custom`] || ''}
              onChange={(e) => onChange(`${field.key}Custom`, e.target.value.slice(0, 40))}
              placeholder={field.customLabel || M.customOptionPlaceholder}
              className="field mt-2"
              autoFocus
            />
          )}
        </>
      )}
      {field.type === 'text' && (
        <input type="text" value={value} onChange={(e) => onChange(field.key, e.target.value.slice(0, 80))} placeholder={field.placeholder} className="field" />
      )}
      {field.type === 'money' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => pick(value === 'free' ? '' : 'free')} className={chip(value === 'free')}>
              {field.freeLabel || M.moneyFree}
            </button>
            <button type="button" onClick={() => pick(value && value !== 'free' ? '' : 'split')} className={chip(Boolean(value) && value !== 'free')}>
              {M.moneySplit}
            </button>
          </div>
          {value && value !== 'free' && (
            <input
              type="text"
              inputMode="decimal"
              value={value === 'split' ? '' : value}
              onChange={(e) => onChange(field.key, e.target.value.replace(/[^\d.,]/g, '').slice(0, 7) || 'split')}
              placeholder={M.moneyAmountPlaceholder}
              className="field mt-2"
              autoFocus
            />
          )}
          {value && value !== 'free' && value !== 'split' && field.amountLabel && (
            <p className="mt-1.5 text-cap text-zine-inkMuted">{field.amountLabel.replace('{сумма}', value)}</p>
          )}
        </>
      )}
    </Field>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block mb-2 text-body font-bold text-zine-ink">{label}</label>
    {children}
  </div>
);

export default EventsScreen;
