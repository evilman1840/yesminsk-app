import { SerialTvSlot, useSerialTv } from '../serial/SerialBits';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { thumb, NO_PHOTO } from '../utils/thumb';
import { Plus, Check, Loader2, Edit2, Trash2, Repeat2, Navigation, MapPinned, Share2, ChevronRight, EyeOff, SlidersHorizontal, X, MapPin } from 'lucide-react';
import { AppEvent, AudienceGender, audienceLabel, EventCategory, EVENT_CATEGORIES_CONFIG, EVENT_CATEGORY_ROWS, LEGACY_CATEGORIES, isLegacyCategory, eventCategoryOf, isGathering, EventTag, EVENT_TAGS, JoinOptions, EventWhen, EVENT_WHEN, matchesWhen, EventPayload, EventTemplate, TemplateField, CUSTOM_TEMPLATE, SUPPORT_RULES, MeetupCreateRequest, MeetupPlace, MeetupFormSource, PlaceItem, WishSummaryItem, WishWindow, MeetupStats, PayTo } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';
import { BottomSheet } from '../components/ui/BottomSheet';
import { HostDonateSheet } from '../components/common/HostDonateSheet';
import { HostBadges, HostsReel, HostsSheet, PastReel, loadMonthHosts } from '../components/common/HostBadges';
import { useOpenUser } from '../context/openUser';
import type { MonthHost } from '../types';
import { markHostDonateSeen, takeHostDonateTurn } from '../utils/hostDonate';
import { formatEventDate } from './MapScreen';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { MapPicker } from '../components/common/MapPicker';
import { EventDetails, plural } from '../components/common/EventDetails';
import { JoinSheet } from '../components/common/JoinSheet';
import { formatDistance } from '../components/common/UserBottomSheet';
import { loadSeenEvents, markEventSeen } from '../utils/seenEvents';
import { UndoToast } from '../components/ui/UndoToast';
import { FilterChip } from '../components/ui/FilterChip';
import { useClosingConfirmation, useMainButton } from '../hooks/useTelegram';
import { HelpLine } from '../components/common/HelpLine';
import { PhotoPicker, PickedPhoto, photoFromUrl, photoSrc } from '../components/common/PhotoPicker';
import { PHOTO_TEXTS } from '../texts/photos';
import { BUDDY_TEXTS } from '../texts/buddies';
import { WishSheet, DELICATE_KINDS } from '../components/common/WishSheet';
import { WishReel, pickReelWishes, reelSlotAfter } from '../components/common/WishReel';
import { InfoToast } from '../components/ui/InfoToast';
import { WISH_TEXTS, wishCounter, wishProgress, bareWishPhrase } from '../texts/wishes';
import { MEETUP_TEXTS as M, priceLabel } from '../texts/meetups';
import { confirmAttendance } from '../context/eventUpdates';
import { areaOf, distanceMeters, farMentionedArea, isKnownPoint, AREA_CHOICES } from '../utils/minskAreas';
import { templateTitle, templateDescription, defaultExtras, templatesForPlace, quickTimes, toLocalInput, eventTemplateEmoji, quickTimeFromParam } from '../utils/meetupTemplates';

import { cachedTemplates, loadTemplates } from '../utils/templatesStore';
import { placeNamedIn } from '../components/places/PlaceSheet';

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
export const markNotInterestedEvent = (id: string) => notInterestedEvents.add(id); // «Неинтересно» на сходке в «Людях»

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
  myCoords?: [number, number]; // точка из анкеты [lat, lng]: расстояние до мест в форме сходки
  myGender?: string; // свой пол: «только девушки / мужчины» можно выбрать только свой
  initialWish?: { placeId?: string; mine?: boolean; kind?: string } | null; // открыть «Хочу сходить» сразу (из сообщения бота; mine — к «Моим желаниям»)
  onInitialWishUsed?: () => void;
  onOpenWishPeople?: (item: WishSummaryItem) => void; // «76 человек хотят на кофе»: список людей, 👋 и «Позвать в компанию»
  initialEdit?: AppEvent | null; // «Изменить» из подробной карточки (карта, места, ссылка): сразу форма редактирования
  onInitialEditUsed?: () => void;
  onOpenWishKind?: (kind: string, includesMe: boolean) => void; // пилюля «☕ Кофе 30»: все, кто хочет этого в любое время
}

// 🏆 «Организаторы месяца»: открывал ли хоть раз (пока нет — кубок мигает)
const HOSTS_SEEN_KEY = 'yesminsk_hosts_seen';
// Баннер «Хочу сходить»: из скольких лучших желаний показываем по очереди и насколько поднимаем ближайшие
const BAR_WISHES = 4;
// Подсказка у звезды «Мои»: сколько раз показали и когда (чтобы не больше двух раз)
const MINE_HINT_KEY = 'yesminsk_mine_hint';
const MINE_HINT_TIMES = 2;
const WINDOW_BOOST: Record<WishWindow, number> = { today: 3, tomorrow: 2, weekend: 1.5, week: 1 };
const nextWishBarTurn = () => {
  try {
    const n = Number(localStorage.getItem('yesminsk_wish_bar_turn') || 0) + 1;
    localStorage.setItem('yesminsk_wish_bar_turn', String(n));
    return n;
  } catch {
    return Math.floor(Math.random() * BAR_WISHES);
  }
};

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
  myCoords,
  myGender,
  initialWish,
  onInitialWishUsed,
  onOpenWishPeople,
  onOpenWishKind,
  initialEdit,
  onInitialEditUsed
}) => {
  // Телевизор сериала в шапке (пока только у админов); без него — шапка как была
  const tv = useSerialTv();
  const currentTgUser = telegramService.getUser();
  const currentUserId = propUserId || currentTgUser?.id;

  // 'kids' — «👶 С детьми»: сходки, куда можно с детьми
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all' | 'kids'>('all');
  const [eventWhen, setEventWhen] = useState<EventWhen>('all'); // сегодня / завтра / выходные
  const [onlyMine, setOnlyMine] = useState(false); // «⭐ Мои»: собираю или иду
  const [mineHint, setMineHint] = useState(false); // подсказка у звезды: «Твои сходки здесь»
  const mineHintTried = useRef(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false); // категория и «Мои» — в шторке
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isRepeat, setIsRepeat] = useState(false); // форма открыта по «Повторить»
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailsEventId, setDetailsEventId] = useState<string | null>(null);
  const [, setHiddenVersion] = useState(0); // перерисовать после «Неинтересно»
  // Уже пролистанные сходки — в конец ленты. Список берём при открытии, чтобы карточки не прыгали, пока листаешь
  const [seenAtOpen] = useState<Set<string>>(() => loadSeenEvents());
  const [justHidden, setJustHidden] = useState<AppEvent | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('cafe');
  const [customCategory, setCustomCategory] = useState('');
  const [locationName, setLocationName] = useState('');
  const [customCoords, setCustomCoords] = useState<[number, number] | null>(null);
  // Что нашли по адресу: подпись для проверки или «не нашли»
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [placeNotFound, setPlaceNotFound] = useState(false);
  // Точку поставили на карте — правка текста адреса её не сбрасывает («у входа» и т.п.)
  const [isPickedOnMap, setIsPickedOnMap] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isAreaPickerOpen, setIsAreaPickerOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [dateTime, setDateTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('0');
  const [seatsBumped, setSeatsBumped] = useState(false);
  const [tags, setTags] = useState<EventTag[]>([]);
  // Для кого: пол и возраст «от–до» (по желанию организатора)
  const [audienceGender, setAudienceGender] = useState<AudienceGender>('all');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
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
  const [payTo, setPayTo] = useState<PayTo>('venue'); // кому платят: заведению или организатору
  const [donation, setDonation] = useState(false);     // взнос организатору — донат по желанию
  const [payFor, setPayFor] = useState('');            // за что взнос
  const [hostDonateOpen, setHostDonateOpen] = useState(false); // опубликовал сходку со взносом — напомнить про донат
  const [byRequest, setByRequest] = useState(false); // «По записи»
  // «Соберу я» из «Хочу сходить»: после публикации бот напишет остальным
  const [wishGroupId, setWishGroupId] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ id: number; name: string }[]>([]); // «Позвать в компанию»
  const [buddy, setBuddy] = useState<{ id: number; name: string } | null>(null); // «👯 Пойдём вместе»: кого бот позовёт после публикации
  // «Хочу сходить»: плашка в ленте и шторка
  const [isWishOpen, setIsWishOpen] = useState(false);
  const [wishToast, setWishToast] = useState<{ sameCount: number; groupSize: number } | null>(null); // отметили желание: что дальше
  // Шторка открыта с уже выбранным видом (чип, пустой фильтр): быстрый режим — осталось «когда»
  const [wishPreset, setWishPreset] = useState<{ kind: string | null; window: WishWindow | null; quick: boolean } | null>(null);
  const openWish = (preset?: { kind: string | null; window?: WishWindow | null }, mine = false) => {
    telegramService.haptic('selection');
    setWishFocusMine(mine);
    setWishPreset(preset ? { kind: preset.kind, window: preset.window || null, quick: true } : null);
    setIsWishOpen(true);
  };
  const [wishPlace, setWishPlace] = useState<PlaceItem | null>(null);
  const [wishFocusMine, setWishFocusMine] = useState(false); // упёрлись в лимит — открыть сразу на «Моих желаниях»
  useEffect(() => {
    if (!initialWish) return;
    setWishPlace((initialWish.placeId && places.find((p) => p.id === initialWish.placeId)) || null);
    setWishFocusMine(Boolean(initialWish.mine));
    if (initialWish.kind) setWishPreset({ kind: initialWish.kind, window: null, quick: true });
    setIsWishOpen(true);
    onInitialWishUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWish]);
  const [wishSummary, setWishSummary] = useState<WishSummaryItem[]>([]);
  const [wishKindCounts, setWishKindCounts] = useState<Record<string, number>>({});
  const [myWishCount, setMyWishCount] = useState(0);
  const [proposeAt, setProposeAt] = useState(3);
  const [meetupStats, setMeetupStats] = useState<MeetupStats | null>(null);
  // «Организаторы месяца» — карточка в ленте; не загрузились или их меньше двух — карточки просто нет
  const [monthHosts, setMonthHosts] = useState<MonthHost[]>([]);
  const openUser = useOpenUser();
  useEffect(() => {
    loadMonthHosts().then(setMonthHosts);
  }, []);
  const [isHostsOpen, setIsHostsOpen] = useState(false); // 🏆 в ряду чипов
  // 🏆 мигает, пока человек ни разу не открыл «Организаторов месяца»
  const [hostsSeen, setHostsSeen] = useState(() => {
    try {
      return localStorage.getItem(HOSTS_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  // Ближайшая сходка организатора из тех, что мне видны
  const nextEventOf = (id: number) =>
    events
      .filter((e) => Number(e.creator?.telegramId) === id && new Date(e.dateTime).getTime() > Date.now())
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0];
  // «Прошедшие» в «⭐ Мои»: свои сходки за три месяца. Обновляем вместе со списком сходок (собрал новую, удалил старую)
  const [pastMine, setPastMine] = useState<AppEvent[]>([]);
  useEffect(() => {
    api.getPastMine().then(setPastMine).catch(() => {});
  }, [events.length]);
  const refreshWishes = () =>
    api
      .getWishes()
      .then((r) => {
        setWishSummary(r.summary || []);
        setWishKindCounts(r.kindCounts || {});
        setMyWishCount((r.mine || []).length);
        setProposeAt(r.proposeAt || 3);
        setMeetupStats(r.stats || null);
      })
      .catch(() => {});
  useEffect(() => {
    refreshWishes();
  }, []);
  // Какое желание показать в баннере: мои (где есть ещё люди) важнее, ближайшее время важнее, больше людей — выше.
  // Через раз — самое лучшее, в остальные заходы по очереди следующие из BAR_WISHES.
  // «Погулять на неделе» в разных местах — одно и то же для баннера: берём то, где больше людей
  const [barTurn] = useState(nextWishBarTurn);
  const barWishes = wishSummary
    .filter((s) => s.count - (s.includesMe ? 1 : 0) > 0)
    .map((s) => ({ s, score: (s.count - (s.includesMe ? 1 : 0)) * WINDOW_BOOST[s.timeWindow] * (s.includesMe ? 2 : 1) }))
    .sort((a, b) => b.score - a.score)
    .filter((x, i, all) => all.findIndex((y) => y.s.kind === x.s.kind && y.s.sport === x.s.sport && y.s.timeWindow === x.s.timeWindow) === i)
    .slice(0, BAR_WISHES)
    .map((x) => x.s);
  // «И ты?» в ленте: чужие желания, к которым я ещё не присоединился(ась)
  const reelWishes = pickReelWishes(wishSummary);
  const topWish = barWishes.length < 2 || barTurn % 2 === 0 ? barWishes[0] : barWishes[1 + (Math.floor(barTurn / 2) % (barWishes.length - 1))];
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
  // «Своя идея»: после выбора сразу показываем, что будем делать, а не верх формы
  const categoryRef = useRef<HTMLDivElement>(null);
  const scrollToCategory = useRef(false);

  // «Опубликовать» — нативная MainButton; requestSubmit запускает и проверку required-полей
  const hasNativeSubmit = useMainButton({
    text: editingEventId ? 'Сохранить' : 'Опубликовать',
    onClick: () => formRef.current?.requestSubmit(),
    loading: isSubmitting,
    active: isModalOpen && !isMapPickerOpen && formStep === 'form'
  });
  useClosingConfirmation(isModalOpen && Boolean(title.trim() || description.trim()));

  // Выбрали «Свою идею» — прокручиваем к выбору типа, когда шторка формы доехала
  useEffect(() => {
    if (!isModalOpen || formStep !== 'form' || !scrollToCategory.current) return;
    scrollToCategory.current = false;
    const t = setTimeout(() => categoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    return () => clearTimeout(t);
  }, [isModalOpen, formStep]);

  // Ошибка формы вверху шторки — прокручиваем к ней, кнопка-то внизу
  useEffect(() => {
    if (!formError) return;
    telegramService.haptic('error');
    formErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [formError]);

  // Звезду «Мои» мало кто замечает. Как только появилась своя сходка (записался или собрал — тут, в «Людях» или на карте),
  // подсказываем у звезды: дважды за всё время и не чаще раза в полсуток; нажал на звезду — больше не показываем
  const hasMine = events.some((e) => e.isJoined || Number(e.creator?.telegramId) === Number(currentUserId));
  // Цифра на звезде: сколько своих ещё впереди (или начались меньше получаса назад), чтобы звезду было видно и без подсказки
  const upcomingMineCount = events.filter(
    (e) => (e.isJoined || Number(e.creator?.telegramId) === Number(currentUserId)) && new Date(e.dateTime).getTime() > Date.now() - 30 * 60 * 1000
  ).length;
  useEffect(() => {
    if (mineHintTried.current || !hasMine || onlyMine || isModalOpen) return;
    mineHintTried.current = true;
    let seen: { n: number; at: number } = { n: 0, at: 0 };
    try {
      seen = JSON.parse(localStorage.getItem(MINE_HINT_KEY) || 'null') || seen;
    } catch {
      return;
    }
    if (seen.n >= MINE_HINT_TIMES || Date.now() - seen.at < 12 * 60 * 60 * 1000) return;
    try {
      localStorage.setItem(MINE_HINT_KEY, JSON.stringify({ n: seen.n + 1, at: Date.now() }));
    } catch {}
    setMineHint(true);
    const t = setTimeout(() => setMineHint(false), 8000);
    return () => clearTimeout(t);
  }, [hasMine, onlyMine, isModalOpen]);
  // Нашёл звезду сам или по подсказке — больше не надоедаем
  const openMine = () => {
    telegramService.haptic('selection');
    setOnlyMine(true);
    setEventWhen('all');
    setMineHint(false);
    try {
      localStorage.setItem(MINE_HINT_KEY, JSON.stringify({ n: MINE_HINT_TIMES, at: Date.now() }));
    } catch {}
  };

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
  // Лента: сходки и между ними карточки «Хочу сходить» (после 4-й и 10-й; сходок меньше — одна в конце). В «⭐ Мои» — без них
  // «Организаторы месяца» — после второй сходки (сходка одна — после неё)
  type FeedItem = { type: 'event'; ev: AppEvent } | { type: 'wish'; slot: number } | { type: 'hosts' } | { type: 'past' };
  const feedItems: FeedItem[] = [];
  const hostsAfter = !onlyMine && monthHosts.length ? Math.min(1, filteredEvents.length - 1) : -1;
  filteredEvents.forEach((ev, i) => {
    feedItems.push({ type: 'event', ev });
    if (i === hostsAfter) feedItems.push({ type: 'hosts' });
    const slot = onlyMine ? null : reelSlotAfter(i, filteredEvents.length);
    if (slot !== null) feedItems.push({ type: 'wish', slot });
  });
  // «Прошедшие» — последней карточкой в «⭐ Мои» (и единственной, если впереди своих сходок нет)
  if (onlyMine && pastMine.length) feedItems.push({ type: 'past' });
  const detailsEvent = detailsEventId ? events.find((e) => String(e.id) === detailsEventId) || null : null;
  const joinEvent = joinEventId ? events.find((e) => String(e.id) === joinEventId) || null : null;
  // После «Вернуть» — сразу показываем возвращённую карточку
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!scrollToId) return;
    const index = feedItems.findIndex((item) => item.type === 'event' && String(item.ev.id) === scrollToId);
    const list = listRef.current;
    if (list && index >= 0) list.scrollTo({ top: index * list.clientHeight });
    setScrollToId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToId]);

  // Одно открытие формы — для воронки «открыли → выбрали идею → опубликовали»
  const formSession = useRef<{ id: string; done: boolean; source?: MeetupFormSource } | null>(null);
  const track = (
    step: 'opened' | 'template' | 'published' | 'closed' | 'error',
    extra: { template?: string; source?: MeetupFormSource; closedAt?: 'pick' | 'form'; missing?: string[]; error?: string } = {}
  ) => {
    if (formSession.current) api.trackMeetupForm({ sessionId: formSession.current.id, step, ...extra });
  };
  const me = isKnownPoint(myCoords) ? myCoords : null;
  // Район и расстояние у места: «Центр · 1,2 км»
  const whereLine = (coords?: [number, number] | null) =>
    [areaOf(coords), me && coords ? formatDistance(distanceMeters(me, coords)) : null].filter(Boolean).join(' · ');
  // Подсказки в поле «Где встречаемся?» — только по делу: места из «Мест» того типа, что нужен шаблону (кофе → кофейни).
  // Подходящих нет — не подставляем «лучшие по рейтингу»: для бассейна кинотеатр только сбивает
  const placeTypes = template && template.key !== CUSTOM_TEMPLATE ? template.placeTypes : [];
  const placeHints = (() => {
    const matching = placeTypes.length ? places.filter((p) => placeTypes.includes(p.category)) : [];
    // Знаем, где человек, — сначала ближайшие
    return (me ? [...matching].sort((a, b) => distanceMeters(me, a.coordinates) - distanceMeters(me, b.coordinates)) : matching).slice(0, 8);
  })();
  // Популярные точки Минска (парки, скверы, площади) — для прогулки, спорта и своей идеи; в кафе, кино и бане они мимо
  const showSpots = !template || template.key === CUSTOM_TEMPLATE || placeTypes.some((t) => t === 'Парк' || t === 'Сквер');
  // Один ряд кнопок: подходящие места из «Мест» (с placeId), за ними точки Минска. Пусто — ряда нет, остаются адрес и карта
  const placeChips = [
    ...placeHints.map((p) => ({ key: `p-${p.id}`, placeId: p.id as string | null, name: p.name, text: p.address && p.address !== p.name ? `${p.name}, ${p.address}` : p.name, coords: p.coordinates })),
    ...(showSpots ? (me ? [...MINSK_SPOTS_PRESETS].sort((a, b) => distanceMeters(me, a.coords) - distanceMeters(me, b.coords)) : MINSK_SPOTS_PRESETS) : [])
      .slice(0, 6)
      .filter((spot) => !placeHints.some((p) => p.name === spot.name))
      .map((spot) => ({ key: `s-${spot.name}`, placeId: null as string | null, name: spot.name, text: spot.name, coords: spot.coords }))
  ];

  // Выбор района вместо точного места: открывается чипом «🤔 Решим вместе» (или кнопкой, если ряда мест нет)
  const areaPicker = isAreaPickerOpen ? (
    <>
      <p className="mb-1.5 text-cap text-zine-inkMuted">{M.areaOnlyHint}</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-3">
        {(me ? [...AREA_CHOICES].sort((a, b) => distanceMeters(me, a.coords) - distanceMeters(me, b.coords)) : AREA_CHOICES).map((area) => (
          <button
            type="button"
            key={area.name}
            onClick={() => {
              telegramService.haptic('selection');
              setLocationName(M.areaOnly(area.name));
              setCustomCoords(area.coords);
              setPlaceLabel(M.areaOnlyLabel);
              setPlaceNotFound(false);
              setIsPickedOnMap(true);
              setPlaceId(null);
              setIsAreaPickerOpen(false);
              setFormError(null);
            }}
            className="h-10 px-3.5 shrink-0 rounded-full border-2 border-zine-border bg-zine-cardElevated text-sm2 text-zine-ink whitespace-nowrap cursor-pointer"
          >
            {area.name}
          </button>
        ))}
      </div>
    </>
  ) : null;

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
    formSession.current = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, done: false, source };
    track('opened', { source });
    setPlaceId(place?.placeId || null);
    setPickPlaceType(place?.placeType);
    setTemplateKey(null);
    setExtras({});
    setDurationMinutes(0);
    setPhotos([]);
    setIsPhotoUploading(false);
    setIsPaid(false);
    setPayTo('venue');
    setDonation(false);
    setPayFor('');
    setByRequest(false);
    setPrice('');
    setWishGroupId(null);
    setInvite([]);
    setBuddy(null);
    // Шаблоны не загрузились — сразу обычная форма
    setFormStep(templates && templates.length ? 'pick' : 'form');
    telegramService.haptic('selection');
    setEditingEventId(null);
    setIsRepeat(false);
    setTitle('');
    setDescription('');
    const startCategory = presetCategory || 'cafe';
    setCategory(startCategory);
    setCustomCategory('');
    setLocationName(place?.name || '');
    setCustomCoords(place?.coordinates || null);
    setPlaceLabel(place?.name || null);
    setPlaceNotFound(false);
    setIsPickedOnMap(Boolean(place));
    setIsAreaPickerOpen(false);
    // По умолчанию — завтра вечером; быстрые кнопки рядом
    setDateTime(toLocalInput(quickTimes().find((q) => q.id === 'tomorrowEvening')!.date));
    setMaxParticipants('0');
    setTags([]);
    setAudienceGender('all');
    setAgeMin('');
    setAgeMax('');
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
    if (initialCreate.invite?.length) setInvite(initialCreate.invite);
    if (initialCreate.buddy) setBuddy(initialCreate.buddy);
    const when = quickTimeFromParam(initialCreate.when);
    if (when) setDateTime(toLocalInput(when));
    onInitialCreateUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCreate, templates]);

  const handleOpenEditModal = (ev: AppEvent) => {
    telegramService.haptic('selection');
    const targetId = String(ev.id || (ev as any)._id);
    setEditingEventId(targetId);
    setIsRepeat(false);
    setTitle(ev.title || '');
    setDescription(ev.description || '');
    // Старые общие типы («Кофе, бар», «Арт, кино») в форме — как первый из новых
    setCategory(LEGACY_CATEGORIES[ev.category] || ev.category || 'walk');
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
    setAudienceGender(ev.audienceGender || 'all');
    setAgeMin(ev.ageMin ? String(ev.ageMin) : '');
    setAgeMax(ev.ageMax ? String(ev.ageMax) : '');
    setTemplateKey(ev.templateId || null);
    setExtras(ev.extras || {});
    setDurationMinutes(ev.durationMinutes || 0);
    setPhotos((ev.photos || []).map(photoFromUrl));
    setIsPaid(Boolean(ev.isPaid));
    setPayTo(ev.payTo === 'host' ? 'host' : 'venue');
    setDonation(Boolean(ev.donation));
    setPayFor(ev.payFor || '');
    setByRequest(Boolean(ev.byRequest));
    setPrice(ev.price ? String(ev.price).replace('.', ',') : '');
    setIsPhotoUploading(false);
    autoText.current = { title: ev.title || '', description: ev.description || '' };
    setFormStep('form');
    setFormError(null);
    setIsModalOpen(true);
  };

  // «Повторить»: новая сходка с теми же данными и фото, дата — тот же день недели и время, ближайшие через неделю.
  // Остаётся проверить и нажать «Опубликовать»
  const handleOpenRepeatModal = (ev: AppEvent) => {
    handleOpenEditModal(ev);
    setEditingEventId(null);
    setIsRepeat(true);
    formSession.current = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, done: false, source: 'repeat' };
    track('opened', { source: 'repeat' });
    setPlaceId(ev.placeId || null);
    setPickPlaceType(undefined);
    setWishGroupId(null);
    setInvite([]);
    setBuddy(null);
    const d = new Date(ev.dateTime);
    if (Number.isNaN(d.getTime())) {
      setDateTime(toLocalInput(quickTimes().find((q) => q.id === 'tomorrowEvening')!.date));
    } else {
      do d.setDate(d.getDate() + 7);
      while (d.getTime() < Date.now() + 60 * 60 * 1000);
      setDateTime(toLocalInput(d));
    }
  };

  // Выбрали шаблон — заполняем форму за человека
  const applyTemplate = (tpl: EventTemplate, presetExtras?: Record<string, string>) => {
    telegramService.haptic('selection');
    if (!editingEventId) track('template', { template: tpl.key });
    setTemplateKey(tpl.key);
    setFormError(null);
    if (tpl.key === CUSTOM_TEMPLATE) {
      scrollToCategory.current = true;
      setExtras({});
      setDurationMinutes(0);
      setTitle('');
      setDescription('');
      setCategory('cafe');
      setTags([]);
      setMaxParticipants('0');
      setIsPaid(false);
      setPayTo('venue');
      setDonation(false);
      setPayFor('');
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
      setPayTo('venue');
      setDonation(false);
      setPayFor('');
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

  useEffect(() => {
    if (!initialEdit) return;
    setDetailsEventId(null);
    if (initialEdit.repeat) handleOpenRepeatModal(initialEdit);
    else handleOpenEditModal(initialEdit);
    onInitialEditUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEdit]);

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
    // Фиксированный взнос организатору — без суммы непонятно, сколько нести
    if (isPaid && payTo === 'host' && !donation && !(Number(price.replace(',', '.')) > 0)) {
      failForm(M.priceHostNeedAmount, 'hostPrice');
      return;
    }

    setIsSubmitting(true);
    try {
      // Всегда определяем точные координаты по введенному адресу
      let resolvedCoords = customCoords;
      // В адресе названо место из «Мест» — ставим сходку в его точку и привязываем к нему (геокодер нашёл бы только улицу)
      const namedPlace = !placeId && !customCoords ? placeNamedIn(locationName, places) : null;
      if (namedPlace) resolvedCoords = namedPlace.coordinates;
      const linkedPlaceId = placeId || namedPlace?.id || null;
      if (!resolvedCoords || resolvedCoords.length !== 2) {
        const found = await handleGeocodeAddress(locationName.trim());
        if (!found) {
          failForm(M.placeNotFound, 'geocode');
          return;
        }
        resolvedCoords = found.coords;
      }

      // «Гуляем в Уручье», а точка в центре — переспрашиваем, но не запрещаем
      const far = farMentionedArea(`${title}\n${description}`, resolvedCoords as [number, number]);
      if (far && !(await telegramService.confirm(M.areaMismatch(far.mentioned, areaOf(resolvedCoords as [number, number]), far.distanceKm), { okText: M.areaMismatchOk }))) {
        return;
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
        audienceGender,
        ageMin: ageMin ? Number(ageMin) : null,
        ageMax: ageMax ? Number(ageMax) : null,
        ...(linkedPlaceId && !editingEventId ? { placeId: linkedPlaceId } : {}),
        ...(templateKey && !editingEventId ? { templateId: templateKey } : {}),
        ...(wishGroupId && !editingEventId ? { wishGroupId } : {}),
        ...(invite.length && !editingEventId ? { inviteIds: invite.map((p) => p.id) } : {}),
        ...(buddy && !editingEventId ? { buddyId: buddy.id } : {}),
        // Из «Тоже хотят» — бот напишет всем, кто хотел того же на это время
        ...(formSession.current?.source === 'people' && !editingEventId ? { notifyWishers: true } : {}),
        durationMinutes,
        photos: photos.map((p) => p.id).filter(Boolean),
        isPaid,
        byRequest,
        price: isPaid && price ? Number(price.replace(',', '.')) || undefined : undefined,
        payTo: isPaid ? payTo : undefined,
        donation: isPaid && payTo === 'host' ? donation : undefined,
        payFor: isPaid && payTo === 'host' ? payFor.trim() : undefined,
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
        const created = onCreateEvent ? await onCreateEvent(payload) : await api.createEvent(payload);
        // По этой сходке окно доната — только сейчас, при входе в приложение второй раз не покажем
        const createdId = created && String(created.id || created._id || '');
        if (createdId) markHostDonateSeen([createdId]);
      }

      if (!editingEventId && formSession.current) {
        track('published', { template: templateKey || undefined });
        formSession.current.done = true;
      }
      closeModal();
      telegramService.haptic('success');
      onRefreshEvents?.();
      // Новая сходка со взносом организатору — попросить поддержать приложение (не чаще раза в неделю)
      if (!editingEventId && isPaid && payTo === 'host' && takeHostDonateTurn()) setHostDonateOpen(true);
    } catch (err: any) {
      failForm(err.message || M.saveFailed, 'server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryIds = (Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).filter(
    // «Своя идея» и старые категории — только если такие сходки есть
    (c) => (c !== 'other' && !isLegacyCategory(c)) || events.some((e) => e.category === c)
  );

  const categoryItems = [['all', 'Все', ''], ...categoryIds.map((c) => [c, EVENT_CATEGORIES_CONFIG[c].label, EVENT_CATEGORIES_CONFIG[c].emoji]), ['kids', 'С детьми', '👶']] as [EventCategory | 'all' | 'kids', string, string][];
  const activeCategory = selectedCategory !== 'all' ? categoryItems.find(([id]) => id === selectedCategory) : undefined;
  const activeFilters = Number(selectedCategory !== 'all');
  // «Хочу сходить» в одно нажатие: виды желаний чипами, у каждого — сколько людей уже хотят (кроме меня; «поныть» без счётчика)
  const wishKinds = (templates || []).filter((t) => t.key !== CUSTOM_TEMPLATE && t.wishPhrase);
  // Разные люди, а не сумма по «когда» и местам: того, кто хочет на кофе и на неделе, и в выходные, считаем один раз
  const wishKindCount = (kind: string) => (DELICATE_KINDS.includes(kind) ? 0 : wishKindCounts[kind] || 0);
  // Пустая лента с фильтром: желание с тем же видом и временем, что выбраны в фильтре
  const emptyWishKind = selectedCategory !== 'all' && selectedCategory !== 'kids' ? wishKinds.find((t) => t.category === selectedCategory) || null : null;
  const emptyWishWindow: WishWindow | null = eventWhen === 'all' ? null : eventWhen;
  // Выбранное в шторке — чипами под шапкой, крестик сбрасывает
  const activeChips = [
    activeCategory && { key: 'cat', label: `${activeCategory[2]} ${activeCategory[1]}`.trim(), onClear: () => setSelectedCategory('all') }
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[];

  const filterButton = (shape: string) => (
        <button
          onClick={() => {
            telegramService.haptic('selection');
            setIsFiltersOpen(true);
          }}
          aria-label={activeFilters > 0 ? `Фильтры: ${activeFilters}` : 'Фильтры'}
          className={`relative w-11 h-11 shrink-0 ${shape} flex items-center justify-center transition-colors cursor-pointer ${
            activeFilters > 0 ? 'bg-zine-ink text-zine-paper' : 'bg-zine-card text-zine-ink'
          }`}
        >
          <SlidersHorizontal size={20} />
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-zine-terracotta text-white text-[11px] font-bold flex items-center justify-center">
              {activeFilters}
            </span>
          )}
        </button>
  );

  return (
    <div className="h-full w-full bg-zine-paper flex flex-col overflow-hidden">
      {/* Шапка на однотонном фоне, чтобы карточка была чистой. Название экрана уже есть в нижнем меню */}
      <div className="shrink-0 px-3 pt-3 pb-3 text-zine-ink">
        <div className="relative flex items-center gap-1.5">
          {/* ⭐ мои (собираю или иду), затем когда: все / сегодня / завтра / выходные — как на карте */}
          <div className="flex-1 min-w-0 flex p-[3px] rounded-full bg-zine-card">
            <button
              onClick={openMine}
              aria-label={M.mineFilter}
              className={`relative flex-auto min-w-[38px] max-w-[44px] h-[38px] px-0.5 rounded-full text-[16px] leading-none flex items-center justify-center transition-all cursor-pointer ${
                onlyMine || mineHint ? 'bg-white' : 'bg-zine-mustard/20'
              } ${mineHint ? 'mine-pulse' : ''}`}
            >
              ⭐
              {/* Есть свои впереди — цифра, как на вкладках: звезда сразу выглядит нажимаемой */}
              {!onlyMine && upcomingMineCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-zine-terracotta text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-zine-card">
                  {upcomingMineCount}
                </span>
              )}
            </button>
            {EVENT_WHEN.map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  telegramService.haptic('selection');
                  setOnlyMine(false);
                  setEventWhen(id);
                }}
                className={`flex-auto min-w-0 h-[38px] px-[3px] rounded-full text-[14px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                  !onlyMine && eventWhen === id ? 'bg-zine-ink text-zine-paper' : 'text-zine-inkMuted'
                }`}
              >
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          {tv ? <SerialTvSlot /> : filterButton('rounded-full')}

          {/* Подсказка под звездой: нажатие ведёт в «Мои», сама исчезает через 8 секунд */}
          {mineHint && (
            <button
              onClick={openMine}
              className="fade-swap absolute left-0 top-full mt-2.5 z-20 max-w-[240px] px-3 py-2 rounded-zine-sm bg-zine-ink text-zine-paper text-sm2 font-semibold text-left shadow-zine-float cursor-pointer"
            >
              <span aria-hidden className="absolute -top-1.5 left-[15px] w-3 h-3 rotate-45 bg-zine-ink" />
              <span className="relative">{M.mineHint}</span>
            </button>
          )}
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
                className="h-9 pl-3 pr-2 shrink-0 rounded-full bg-zine-ink text-zine-paper text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="whitespace-nowrap">{c.label}</span>
                <X size={16} className="opacity-60" />
              </button>
            ))}
          </div>
        )}

        {/* «Хочу сходить» в одну строку высотой с «Собрать»: шторка желаний (выбрать, куда хочется).
            Кто уже хочет — первой пилюлей в ряду ниже, она ведёт на список этих людей */}
        <div className="mt-2.5 flex gap-1.5 h-11">
          <button
            onClick={() => openWish()}
            className="min-w-0 flex-1 pl-1.5 pr-2 rounded-zine-sm bg-zine-card border border-zine-border flex items-center gap-2 text-left active:scale-[0.98] transition-transform cursor-pointer"
          >
            <span className={`w-7 h-7 shrink-0 rounded-full bg-zine-terracotta text-white flex items-center justify-center text-[15px] leading-none ${tv ? 'max-[369px]:hidden' : ''}`} aria-hidden>🙋</span>
            <span className="min-w-0 flex-1 text-body font-bold text-zine-ink truncate">{WISH_TEXTS.barTitle}</span>
            {!topWish && myWishCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 shrink-0 rounded-full bg-zine-terracotta/15 text-zine-terracotta text-cap font-bold flex items-center justify-center">{myWishCount}</span>
            )}
            {/* Рядом фильтры — стрелку убираем, чтобы «Хочу сходить» не обрезалось */}
            {!tv && <ChevronRight size={18} className="shrink-0 text-zine-inkMuted" />}
          </button>
          {/* С телевизором сериала в шапке фильтры переезжают сюда */}
          {tv && filterButton('rounded-zine-sm')}
          {/* Не нашлось подходящей — собрать свою */}
          <button
            onClick={() => handleOpenCreateModal(undefined, undefined, 'feed')}
            className="px-3 shrink-0 rounded-zine-sm bg-zine-terracotta active:bg-zine-terracottaHover text-white text-sm2 font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span>{M.createButtonShort}</span>
          </button>
        </div>
        {/* Быстрые желания: вид в одно нажатие, дальше только «когда» */}
        {(wishKinds.length > 0 || topWish || monthHosts.length > 0) && (
          <div className="mt-2 -mx-3 px-3 flex gap-1.5 overflow-x-auto no-scrollbar">
            {/* 🏆 «Организаторы месяца» — тот же список, что карточкой в ленте. Первым в ряду чипов: в ряду с «Хочу сходить» он обрезал надпись; организаторов нет — кнопки нет */}
            {monthHosts.length > 0 && (
              <button
                onClick={() => {
                  telegramService.haptic('selection');
                  setIsHostsOpen(true);
                  if (!hostsSeen) {
                    setHostsSeen(true);
                    try {
                      localStorage.setItem(HOSTS_SEEN_KEY, '1');
                    } catch {}
                  }
                }}
                aria-label={M.hostsTitle}
                className={`w-9 h-9 shrink-0 rounded-full bg-zine-card border border-zine-border text-[17px] leading-none flex items-center justify-center active:scale-95 transition-transform cursor-pointer ${hostsSeen ? '' : 'mine-pulse border-zine-mustard'}`}
              >
                🏆
              </button>
            )}
            {/* «2 человека хотят на выставку на неделе» — список этих людей: 👋, позвать в компанию, «Я тоже хочу» */}
            {topWish && (
              <button
                onClick={() => {
                  telegramService.haptic('selection');
                  if (onOpenWishPeople) onOpenWishPeople(topWish);
                  else openWish();
                }}
                className="h-9 pl-2.5 pr-3 shrink-0 rounded-full bg-zine-terracotta/15 border border-zine-terracotta/30 text-sm2 font-semibold text-zine-terracotta flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
              >
                <span aria-hidden>🙋</span>
                <span className="whitespace-nowrap">{wishCounter(topWish)}</span>
                <span aria-hidden className="font-bold">→</span>
              </button>
            )}
            {wishKinds.map((t) => {
              const n = wishKindCount(t.key);
              return (
                <button
                  key={t.key}
                  // Кто-то уже хочет — список людей (👋, позвать в компанию, «Я тоже хочу»); никого — сразу форма желания
                  onClick={() => {
                    if (n > 0 && onOpenWishKind) {
                      telegramService.haptic('selection');
                      onOpenWishKind(t.key, wishSummary.some((s) => s.kind === t.key && s.includesMe));
                    } else openWish({ kind: t.key });
                  }}
                  className="h-9 pl-2.5 pr-3 shrink-0 rounded-full bg-zine-card border border-zine-border text-sm2 font-semibold text-zine-ink flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                >
                  <span aria-hidden>{t.emoji}</span>
                  <span className="whitespace-nowrap">{t.name}</span>
                  {n > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-zine-terracotta/15 text-zine-terracotta text-cap font-bold flex items-center justify-center">{n}</span>}
                </button>
              );
            })}
            <button
              onClick={() => openWish({ kind: CUSTOM_TEMPLATE })}
              className="h-9 px-3 shrink-0 rounded-full bg-zine-card border border-zine-border text-sm2 font-semibold text-zine-ink flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
            >
              <span aria-hidden>✍️</span>
              <span className="whitespace-nowrap">{WISH_TEXTS.quickOther}</span>
            </button>
          </div>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
      {feedItems.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 text-zine-ink">
          <div className="text-[48px] mb-3">🗓</div>
          <p className="font-serif font-bold text-title">{onlyMine ? M.mineEmptyTitle : M.emptyTitle}</p>
          <p className="mt-2 text-body text-zine-inkMuted">{onlyMine ? M.mineEmptyText : M.emptyText}</p>
          <button
            onClick={() => {
              handleOpenCreateModal(selectedCategory === 'all' || selectedCategory === 'kids' ? undefined : selectedCategory, undefined, 'empty');
              if (selectedCategory === 'kids') setTags(['kids']);
            }}
            className="mt-5 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer"
          >
            {M.createButton}
          </button>
          {/* Фильтр пустой — желание с тем же видом и временем: осталось подтвердить */}
          {!onlyMine && (
            <button
              onClick={() => openWish(emptyWishKind || emptyWishWindow ? { kind: emptyWishKind?.key || null, window: emptyWishWindow } : undefined)}
              className="mt-3 h-12 px-6 rounded-full bg-zine-card text-zine-ink text-body font-semibold cursor-pointer"
            >
              {emptyWishKind || emptyWishWindow
                ? WISH_TEXTS.emptyWantFor(emptyWishKind ? bareWishPhrase(emptyWishKind.wishPhrase) : 'сходить', emptyWishWindow ? WISH_TEXTS.whenPhrase[emptyWishWindow] : '')
                : WISH_TEXTS.emptyWant}
            </button>
          )}
        </div>
      ) : (
        <div key={`${selectedCategory}-${eventWhen}`} ref={listRef} className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
          {feedItems.map((item, index) => {
            if (item.type === 'wish') {
              const w = reelWishes[item.slot] || null;
              return (
                <WishReel key={`wish-${item.slot}`} wish={w} proposeAt={proposeAt} stats={meetupStats} onWho={onOpenWishPeople} onOpen={() => openWish()} onOpenMine={() => openWish(undefined, true)} onChanged={refreshWishes} />
              );
            }
            if (item.type === 'past') {
              return <PastReel key="past" events={pastMine} emojiOf={(e) => eventTemplateEmoji(e, templates) || eventCategoryOf(e).emoji} dateOf={formatEventDate} onRepeat={handleOpenRepeatModal} />;
            }
            if (item.type === 'hosts') {
              return (
                <HostsReel
                  key="hosts"
                  hosts={monthHosts}
                  nextEventOf={nextEventOf}
                  onOpenUser={openUser}
                  onOpenEvent={(e) => setDetailsEventId(String(e.id))}
                  onCreate={() => handleOpenCreateModal(undefined, undefined, 'hosts')}
                  onOpenAll={() => setIsHostsOpen(true)}
                />
              );
            }
            const ev = item.ev;
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
                // «По записи»: подтверждённую запись не меняют — открываем подробности
                onJoin={() => (ev.myApproved ? setDetailsEventId(String(ev.id)) : setJoinEventId(String(ev.id)))}
                onLeave={async () => {
                  if (!(await telegramService.confirm(M.notGoingConfirm(ev.title), { okText: M.notGoingOk, destructive: true }))) return;
                  handleJoin(ev, null);
                }}
                onEdit={() => handleOpenEditModal(ev)}
                onRepeat={() => handleOpenRepeatModal(ev)}
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
          topClass="top-3"
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
      </div>

      {isFiltersOpen && (
        <BottomSheet title="Фильтры" onClose={() => setIsFiltersOpen(false)}>
          <p className="mb-2.5 text-body font-bold text-zine-ink">Что за сходка</p>
          <div className="flex flex-wrap gap-2">
            {categoryItems.map(([id, label, emoji]) => (
              <FilterChip key={id} active={selectedCategory === id} onClick={() => setSelectedCategory(id)}>
                {emoji && <span className="text-[18px] leading-none">{emoji}</span>}
                <span>{label}</span>
              </FilterChip>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className="h-12 px-5 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold cursor-pointer"
            >
              Сбросить
            </button>
            <button onClick={() => setIsFiltersOpen(false)} className="h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
              {filteredEvents.length > 0 ? `Показать (${filteredEvents.length})` : 'Ничего не нашлось'}
            </button>
          </div>
        </BottomSheet>
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
      {isHostsOpen && <HostsSheet hosts={monthHosts} nextEventOf={nextEventOf} onOpenEvent={(e) => setDetailsEventId(String(e.id))} onClose={() => setIsHostsOpen(false)} />}

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
        <BottomSheet title={editingEventId ? M.editMeetup : isRepeat ? M.repeatMeetup : M.newMeetup} onClose={closeModal}>
          {/* noValidate: вместо всплывашек браузера (в Telegram их часто не видно) — наша подсказка, что именно не заполнено */}
          <form ref={formRef} onSubmit={handleSubmitForm} noValidate className="space-y-5">
            {formError && (
              <div ref={formErrorRef} className="p-3 rounded-zine-sm bg-zine-danger/10 text-zine-danger text-sm2 font-semibold">{formError}</div>
            )}

            {isRepeat && !editingEventId && <p className="p-3 rounded-zine-sm bg-zine-sage/15 text-sm2 font-semibold text-zine-ink">🔁 {M.repeatHint}</p>}

            {/* «Позвать в компанию»: кого бот пригласит после публикации */}
            {!editingEventId && invite.length > 0 && (
              <div className="p-3 rounded-zine-sm bg-zine-terracotta/10 flex items-start gap-2">
                <p className="flex-1 min-w-0 text-sm2 font-semibold text-zine-ink">{WISH_TEXTS.inviteLine(invite.map((p) => p.name).join(', '))}</p>
                <button type="button" onClick={() => setInvite([])} className="shrink-0 text-sm2 font-bold text-zine-terracotta cursor-pointer">
                  {WISH_TEXTS.inviteRemove}
                </button>
              </div>
            )}

            {/* «👯 Пойдём вместе»: кого бот позовёт после публикации */}
            {!editingEventId && buddy && (
              <div className="p-3 rounded-zine-sm bg-zine-terracotta/10 flex items-start gap-2">
                <p className="flex-1 min-w-0 text-sm2 font-semibold text-zine-ink">{BUDDY_TEXTS.formLine(buddy.name)}</p>
                <button type="button" onClick={() => setBuddy(null)} className="shrink-0 text-sm2 font-bold text-zine-terracotta cursor-pointer">
                  {BUDDY_TEXTS.formRemove}
                </button>
              </div>
            )}

            {/* Выбранный шаблон — можно сменить */}
            {!editingEventId && !isRepeat && template && templates && templates.length > 0 && (
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
              {placeChips.length > 0 && (
              <>
              <p className="mb-1.5 text-cap font-semibold text-zine-inkMuted">{M.pickPlaceHint}</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-3">
                {/* «Пока не знаю где» — первым: внизу под адресом его никто не находил (0 сходок за 5 дней) */}
                <button
                  type="button"
                  onClick={() => {
                    telegramService.haptic('selection');
                    setIsAreaPickerOpen((v) => !v);
                  }}
                  className={`h-10 px-3.5 shrink-0 rounded-full border-2 border-dashed text-sm2 whitespace-nowrap cursor-pointer transition-colors ${
                    isAreaPickerOpen || placeLabel === M.areaOnlyLabel
                      ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta font-semibold'
                      : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                  }`}
                >
                  {M.areaChip}
                </button>
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
                        setIsAreaPickerOpen(false);
                        setFormError(null);
                      }}
                      className={`h-10 px-3.5 shrink-0 rounded-full border-2 text-sm2 whitespace-nowrap cursor-pointer transition-colors ${
                        active ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta font-semibold' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                      }`}
                    >
                      {chip.placeId ? '📍 ' : ''}{chip.name}
                      {whereLine(chip.coords) && <span className={`font-normal ${active ? '' : 'text-zine-inkMuted'}`}> · {whereLine(chip.coords)}</span>}
                    </button>
                  );
                })}
              </div>
              {areaPicker}
              </>
              )}

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

              {/* Точного места нет — только район: сходку можно опубликовать сразу, а место решить с теми, кто запишется.
                  Есть ряд готовых мест — этот вариант первым в ряду («🤔 Решим вместе»), отдельная кнопка не нужна */}
              {placeChips.length === 0 && !customCoords && (
                <button
                  type="button"
                  onClick={() => {
                    telegramService.haptic('selection');
                    setIsAreaPickerOpen((v) => !v);
                  }}
                  className="mt-2 w-full h-11 rounded-zine-sm border-2 border-dashed border-zine-border text-sm2 font-semibold text-zine-ink cursor-pointer"
                >
                  {M.areaOnlyBtn}
                </button>
              )}
              {placeChips.length === 0 && areaPicker}

              {customCoords && placeLabel && !isGeocoding && (
                <div className="mt-2 p-3 rounded-zine-sm bg-zine-sage/15 flex items-center gap-3 text-zine-ink">
                  <MapPinned size={20} className="text-zine-sage shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold truncate">{placeLabel}</span>
                    {(areaOf(customCoords) || me) && (
                      <span className="block text-sm2 text-zine-inkMuted">
                        {[areaOf(customCoords), me ? M.fromYou(formatDistance(distanceMeters(me, customCoords)) || '') : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      telegramService.haptic('selection');
                      setLocationName('');
                      setCustomCoords(null);
                      setPlaceLabel(null);
                      setPlaceId(null);
                      setIsPickedOnMap(false);
                    }}
                    className="h-9 px-3 shrink-0 rounded-full bg-zine-cardElevated text-sm2 font-semibold text-zine-terracotta cursor-pointer"
                  >
                    {M.placeChange}
                  </button>
                </div>
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
              <div ref={categoryRef} className="scroll-mt-2">
              <Field label="Что будем делать?">
                {/* Чипы по рядам: ряд — одна группа, всё видно сразу; «Своя идея» — отдельным рядом. У выбранного вместо значка галочка */}
                <div className="flex flex-col gap-2">
                  {[...EVENT_CATEGORY_ROWS, ['other'] as EventCategory[]].map((row, i) => (
                    <div key={i} className="flex flex-wrap gap-1.5">
                      {row.map((cat) => {
                        const cfg = EVENT_CATEGORIES_CONFIG[cat];
                        const isSelected = category === cat;
                        const isOwn = cat === 'other';
                        return (
                          <button
                            type="button"
                            key={cat}
                            aria-pressed={isSelected}
                            onClick={() => {
                              telegramService.haptic('selection');
                              setCategory(cat);
                              // «Поныть» — маленькой группой, чтобы каждый успел выговориться
                              if (cat === 'support' && (maxParticipants === '0' || !maxParticipants)) setMaxParticipants('6');
                            }}
                            className={`h-11 pl-2 pr-2.5 rounded-full border-2 inline-flex items-center gap-1 text-sm2 font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? 'border-zine-terracotta bg-zine-terracotta text-white'
                                : `${isOwn ? 'border-dashed' : ''} border-zine-border bg-zine-cardElevated text-zine-ink`
                            }`}
                          >
                            {isSelected ? <Check size={18} strokeWidth={3} /> : <span className="text-[17px] leading-none">{cfg.emoji}</span>}
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
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
              </div>
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

            {/* «По записи»: организатор подтверждает каждого, сам отменить подтверждённую запись нельзя */}
            <Field label={M.byRequestLabel}>
              <div className="flex gap-2">
                {[false, true].map((on) => (
                  <button
                    type="button"
                    key={String(on)}
                    onClick={() => {
                      telegramService.haptic('selection');
                      setByRequest(on);
                    }}
                    className={`h-11 px-4 rounded-full border-2 text-sm2 font-semibold cursor-pointer transition-colors ${
                      byRequest === on ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                    }`}
                  >
                    {on ? M.byRequestOn : M.byRequestOff}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-cap text-zine-inkMuted">{byRequest ? (editingEventId ? M.byRequestEditHint : M.byRequestHint) : M.byRequestOffHint}</p>
            </Field>

            <Field label={M.priceLabel}>
              {/* Бесплатно / кассе или кафе / мне (организатору): три равные кнопки в ряд, значок над словом */}
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={M.priceLabel}>
                {([
                  ['free', M.priceFree],
                  ['venue', M.priceVenue],
                  ['host', M.priceHost]
                ] as const).map(([kind, label]) => {
                  const active = kind === 'free' ? !isPaid : isPaid && payTo === kind;
                  const [emoji, ...words] = label.split(' ');
                  return (
                    <button
                      type="button"
                      key={kind}
                      aria-pressed={active}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setIsPaid(kind !== 'free');
                        if (kind !== 'free') setPayTo(kind);
                      }}
                      className={`py-2 px-1 rounded-zine-sm border-2 flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                        active ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
                      }`}
                    >
                      <span className="text-[22px] leading-none">{emoji}</span>
                      <span className={`text-sm2 leading-tight text-center font-semibold ${active ? 'text-zine-terracotta' : 'text-zine-ink'}`}>{words.join(' ')}</span>
                    </button>
                  );
                })}
              </div>
              {isPaid && payTo === 'host' && (
                <div className="flex gap-2 mt-2">
                  {[false, true].map((don) => (
                    <button
                      type="button"
                      key={String(don)}
                      onClick={() => {
                        telegramService.haptic('selection');
                        setDonation(don);
                      }}
                      className={`h-10 px-4 rounded-full border-2 text-sm2 font-semibold cursor-pointer transition-colors ${
                        donation === don ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                      }`}
                    >
                      {don ? M.priceHostDonation : M.priceHostFixed}
                    </button>
                  ))}
                </div>
              )}
              {isPaid && (
                <>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
                    placeholder={payTo === 'venue' ? M.priceAmountPlaceholder : donation ? M.priceDonationAmountPlaceholder : M.priceHostAmountPlaceholder}
                    className="field mt-2"
                  />
                  {payTo === 'host' && (
                    <input
                      type="text"
                      value={payFor}
                      onChange={(e) => setPayFor(e.target.value.slice(0, 60))}
                      placeholder={M.priceForPlaceholder}
                      className="field mt-2"
                    />
                  )}
                  <p className="mt-1.5 text-cap text-zine-inkMuted">
                    {payTo === 'venue' ? M.priceVenueHint : donation ? M.priceDonationHint : M.priceHostHint}
                  </p>
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

            {/* Для кого по полу и возрасту — по желанию */}
            <Field label={M.audienceGenderLabel}>
              <div className="flex flex-wrap gap-2">
                {(['all', ...(myGender === 'female' || myGender === 'male' ? [myGender] : [])] as AudienceGender[]).map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => {
                      telegramService.haptic('selection');
                      setAudienceGender(g);
                    }}
                    className={`h-11 px-4 rounded-full border-2 text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      audienceGender === g ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-terracotta' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
                    }`}
                  >
                    {g === 'female' ? M.audienceFemale : g === 'male' ? M.audienceMale : M.audienceAll}
                  </button>
                ))}
              </div>
              {myGender !== 'female' && myGender !== 'male' && <p className="mt-1.5 text-cap text-zine-inkMuted">{M.audienceNoGender}</p>}
            </Field>

            <Field label={M.audienceAgeLabel}>
              <div className="flex items-center gap-2">
                <input type="number" inputMode="numeric" min={18} max={99} value={ageMin} onChange={(e) => setAgeMin(e.target.value.slice(0, 2))} placeholder={M.audienceAgeFrom} className="field" />
                <span className="text-zine-inkMuted">–</span>
                <input type="number" inputMode="numeric" min={18} max={99} value={ageMax} onChange={(e) => setAgeMax(e.target.value.slice(0, 2))} placeholder={M.audienceAgeTo} className="field" />
              </div>
              <p className="mt-1.5 text-cap text-zine-inkMuted">{M.audienceHint}</p>
            </Field>

            {/* Где можно собираться — последним, прямо перед «Опубликовать» */}
            <p className="p-3 rounded-zine-sm bg-zine-terracotta/10 text-sm2 text-zine-ink">⚖️ {M.legalVenueHint}</p>

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
          presetKind={wishPreset?.kind}
          presetWindow={wishPreset?.window}
          quick={wishPreset?.quick}
          focusMine={wishFocusMine}
          onClose={() => {
            setIsWishOpen(false);
            setWishPlace(null);
            setWishPreset(null);
            refreshWishes();
          }}
          onChanged={refreshWishes}
          onOpenPeople={
            onOpenWishPeople &&
            ((item) => {
              setIsWishOpen(false);
              setWishPlace(null);
              onOpenWishPeople(item);
            })
          }
          onCreated={(sameCount, groupSize) => {
            setIsWishOpen(false);
            setWishPlace(null);
            setWishPreset(null);
            setWishToast({ sameCount, groupSize });
            refreshWishes();
          }}
        />
      )}
      {hostDonateOpen && <HostDonateSheet onClose={() => setHostDonateOpen(false)} />}

      {wishToast !== null && (
        <InfoToast
          title={WISH_TEXTS.toastTitle}
          text={
            wishToast.groupSize >= 2
              ? wishProgress(wishToast.groupSize, proposeAt)
              : [WISH_TEXTS.toastText, wishToast.sameCount > 0 ? WISH_TEXTS.sameCount(wishToast.sameCount) : ''].filter(Boolean).join(' ')
          }
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
  cafe: 'from-[#C9973A] to-[#3B2C1A]',
  bar: 'from-[#8E4A5C] to-[#2B1C22]',
  restaurant: 'from-[#B0704A] to-[#33231A]',
  cafe_bar: 'from-[#C9973A] to-[#3B2C1A]',
  exhibition: 'from-[#7C4A6E] to-[#2A1D27]',
  museum: 'from-[#6A5A8A] to-[#211D2A]',
  cinema: 'from-[#5A3A5E] to-[#1F1620]',
  expo_cinema: 'from-[#7C4A6E] to-[#2A1D27]',
  trip_outdoors: 'from-[#5B7B68] to-[#1F2A23]',
  boardgames: 'from-[#4A7396] to-[#1C2732]',
  sport: 'from-[#3F8A8C] to-[#1A2B2C]',
  relax: 'from-[#5E8FA8] to-[#1B2830]',
  learn: 'from-[#8A6A3E] to-[#2B2218]',
  support: 'from-[#9A7BA8] to-[#2A2230]',
  other: 'from-[#C77D86] to-[#33222A]'
};

/**
 * Сходка: сверху чистая обложка (фото или цвет категории со значком), под ней текст на сплошном фоне и кнопки под большим пальцем
 */
// Дата на обложке: «Сегодня, 19:00», «Завтра, 17:00», дальше — «Вс, 22 ноября, 17:00»
const coverDate = (iso: string) => {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86400000);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `Сегодня, ${time}`;
  if (diff === 1) return `Завтра, ${time}`;
  const s = formatEventDate(iso);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const EventReel: React.FC<{
  event: AppEvent;
  isFirst: boolean;
  isCreator: boolean;
  isJoining: boolean;
  isDeleting: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onEdit: () => void;
  onRepeat?: () => void; // своя прошедшая сходка: вместо «Изменить» — «Повторить»
  onDelete: () => void;
  onOpenDetails: () => void;
  onNotInterested: () => void;
  onSeen?: () => void;
  emoji?: string | null;
  // Сходка в ленте «Людей»: тёмная карточка с подписью, кто из знакомых идёт, и толчок вибрацией при остановке
  spotlight?: { label: string; friendIds: Set<number> };
}> = ({ event: ev, isFirst, isCreator, isJoining, isDeleting, onJoin, onLeave, onEdit, onRepeat, onDelete, onOpenDetails, onNotInterested, onSeen, emoji, spotlight }) => {
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
  // В «Людях»: карточка встала на экран — один лёгкий толчок, чтобы заметили, что это не анкета
  useEffect(() => {
    const el = reelRef.current;
    if (!el || !spotlight) return;
    let done = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !done) {
          done = true;
          telegramService.haptic('light');
          io.disconnect();
        }
      },
      { threshold: 0.8 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cat = eventCategoryOf(ev);
  const isFull = !ev.isJoined && Boolean(ev.maxParticipants) && (ev.participantsCount || 1) >= ev.maxParticipants;
  const notForMe = !ev.isJoined ? ev.notForMe : undefined;
  // Все, кто идёт; если сервер ещё старый и прислал не всех — хотя бы организатор
  const people = ev.participants?.length ? ev.participants : [ev.creator];
  // «Аня, Дима +3 идут»: сначала знакомые (на связи, кому передал 👋), потом остальные
  const isFriend = (p: (typeof people)[number]) => Boolean(p && spotlight?.friendIds.has(Number(p.telegramId)));
  const goingPeople = spotlight ? [...people.filter(isFriend), ...people.filter((p) => p && !isFriend(p))] : [];
  const goingNames = goingPeople.map((p) => p?.name).filter(Boolean) as string[];
  const goingTotal = ev.participantsCount || people.length;

  const isPending = ev.isJoined && ev.byRequest && !ev.myApproved;
  const isStarted = new Date(ev.dateTime).getTime() <= Date.now();

  return (
    <SwipeReel
      className={spotlight ? 'flex flex-col reel-night top-2 bottom-2 left-2 right-2 rounded-zine bg-zine-paper text-zine-ink shadow-zine-float' : 'flex flex-col'}
      rightLabel="Подробнее"
      rightBehavior="stay"
      leftLabel={isCreator || ev.isJoined ? undefined : 'Неинтересно'}
      leftBehavior="remove"
      onSwipe={(dir) => (dir === 'right' ? onOpenDetails() : onNotInterested())}
    >
      {spotlight && <p className="shrink-0 px-4 pt-3 pb-2 text-sm2 font-bold text-zine-terracotta">✨ {spotlight.label}</p>}
      {/* Обложка: первое фото сходки, без фото — цвет категории и крупный значок.
          Поверх — главное, что читается за секунду: категория и кто идёт — сверху, когда — снизу */}
      <div
        ref={reelRef}
        onClick={onOpenDetails}
        className={`relative mx-3 flex-1 min-h-[30%] rounded-zine overflow-hidden bg-gradient-to-br cursor-pointer ${REEL_BG[ev.category] || REEL_BG.walk}`}
      >
        {ev.photos?.length ? (
          <img src={photoSrc(ev.photos[0])} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[88px] leading-none select-none pointer-events-none">{emoji || cat.emoji}</div>
        )}
        <span className="absolute left-3 top-3 max-w-[calc(100%-140px)] h-9 px-3 rounded-full bg-black/55 backdrop-blur-sm text-white text-sm2 font-semibold flex items-center gap-1.5 pointer-events-none truncate">
          {ev.isOfficial && <span className="text-zine-mustard">⭐</span>}
          <span aria-hidden>{cat.emoji}</span>
          <span className="truncate">{cat.label}</span>
        </span>
        <span className={`absolute left-3 ${spotlight ? 'top-14' : 'bottom-3'} max-w-[calc(100%-24px)] h-10 px-3.5 rounded-full bg-black/65 backdrop-blur-sm text-white text-body font-bold flex items-center whitespace-nowrap pointer-events-none`}>
          {coverDate(ev.dateTime)}
          {ev.durationMinutes ? <span className="ml-1 font-normal text-white/75">· {M.duration(ev.durationMinutes)}</span> : null}
        </span>
        {!spotlight && (
          <span className="absolute right-3 top-3 h-9 pl-1 pr-3 rounded-full bg-black/65 backdrop-blur-sm text-white text-sm2 font-bold flex items-center gap-2 whitespace-nowrap pointer-events-none">
            <span className="flex -space-x-2">
              {people.slice(0, 3).map((p, i) => (
                <img
                  key={`${p?.telegramId}-${i}`}
                  src={thumb(p?.avatarUrl) || NO_PHOTO}
                  alt=""
                  loading="lazy"
                  className={`w-7 h-7 rounded-full object-cover border-2 ${p && 'confirmed' in p && p.confirmed ? 'border-zine-sage' : 'border-black/40'}`}
                />
              ))}
            </span>
            {ev.maxParticipants ? `${ev.participantsCount || 1} из ${ev.maxParticipants}` : `${ev.participantsCount || 1}`}
          </span>
        )}
        {spotlight && goingNames.length > 0 && (
          <div className="absolute left-3 bottom-3 max-w-[calc(100%-24px)] pl-2 pr-3 py-1.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-cap font-semibold flex items-center gap-2 pointer-events-none">
            <span className="flex -space-x-2 shrink-0">
              {goingPeople.slice(0, 3).map((p, i) => (
                <img key={`${p?.telegramId}-${i}`} src={thumb(p?.avatarUrl) || NO_PHOTO} alt="" className="w-6 h-6 rounded-full object-cover border-2 border-black/40" />
              ))}
            </span>
            <span className="truncate">
              {goingNames.slice(0, 2).join(', ')}
              {goingTotal > 2 ? ` +${goingTotal - Math.min(2, goingNames.length)}` : ''} {goingTotal === 1 ? 'идёт' : 'идут'}
            </span>
          </div>
        )}
        {/* Подсказка про свайпы — только на первой карточке, внизу обложки */}
        {isFirst && <SwipeHint className="top-1/2 -translate-y-1/2" left={isCreator || ev.isJoined ? undefined : 'неинтересно'} right="подробнее" />}
      </div>

      {/* Текст на сплошном фоне; нажатие мимо кнопок — подробности */}
      <div
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) onOpenDetails();
        }}
        className="shrink-0 px-4 pt-3 text-zine-ink cursor-pointer"
      >
        {/* Одна строка: пометки значками, цена и метки шаблона («💸 Платно»); категория — на обложке. Не влезает — листается */}
        <div data-no-swipe className="-mx-4 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar fade-right text-sm2 font-semibold text-zine-inkMuted whitespace-nowrap empty:hidden">
          {(ev.tags || []).length > 0 && (
            <span className="shrink-0" aria-label={(ev.tags || []).map((t) => EVENT_TAGS[t].label).join(', ')}>
              {(ev.tags || []).map((t) => EVENT_TAGS[t].emoji).join(' ')}
            </span>
          )}
          {[ev.byRequest ? M.byRequestBadge : '', audienceLabel(ev), priceLabel(ev), ...(ev.badges || [])].filter(Boolean).map((b) => (
            <span key={b} className="h-7 px-2.5 shrink-0 rounded-full border border-zine-border bg-zine-card text-cap font-semibold text-zine-ink flex items-center">
              {b}
            </span>
          ))}
        </div>
        <h2 className="mt-1 font-serif font-bold text-title leading-tight line-clamp-2">{ev.title}</h2>
        {/* Только место: расстояние часто не сходится с жизнью */}
        <p className="mt-0.5 flex items-center gap-1.5 text-sm2 text-zine-inkMuted">
          <MapPin size={16} className="shrink-0" />
          <span className="truncate">{ev.locationName}</span>
        </p>
        {/* Организатор — одной строкой: «Собирает Назар · проведена 1 сходка 🌱». Кто ещё идёт — лицами на обложке.
            «Стесняешься?» — в подробностях сходки */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm2 text-zine-inkMuted">
          <span className="min-w-0">
            <span className="font-semibold text-zine-ink">{isCreator ? M.hostMine : M.hostLine(ev.creator?.name || '')}</span>
            {ev.host && ev.host.held > 0 && ` · ${M.hostedCount(ev.host.held)}`}
          </span>
          {ev.host && <HostBadges host={ev.host} />}
        </p>
      </div>

      {/* Кнопки под большим пальцем: «Позвать», «Неинтересно» и главное действие */}
      <div className="shrink-0 px-4 pt-3 pb-3 text-zine-ink">
        <div className="flex gap-2">
          <button
            onClick={() => {
              telegramService.haptic('selection');
              telegramService.shareEvent(ev);
            }}
            aria-label="Позвать друзей"
            className="w-12 h-12 shrink-0 rounded-full border border-zine-border flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            <Share2 size={20} />
          </button>
          {isCreator ? (
            // Своя сходка: организатор и так идёт — вместо «Пойду» управление
            <>
              <button
                onClick={isStarted && onRepeat ? onRepeat : onEdit}
                className="flex-1 h-12 rounded-full bg-zine-ink text-zine-paper text-body font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
              >
                {isStarted && onRepeat ? <Repeat2 size={19} /> : <Edit2 size={19} />}
                <span>{isStarted && onRepeat ? M.repeat : 'Изменить'}</span>
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                aria-label="Удалить сходку"
                className="w-12 h-12 shrink-0 rounded-full border border-zine-border flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              >
                {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
              </button>
            </>
          ) : (
            <>
              {!ev.isJoined && (
                <button
                  onClick={() => {
                    telegramService.haptic('selection');
                    onNotInterested();
                  }}
                  aria-label="Скрыть"
                  className="w-12 h-12 shrink-0 rounded-full border border-zine-border flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                >
                  <EyeOff size={20} />
                </button>
              )}
              <button
                onClick={onJoin}
                disabled={isJoining || isFull || Boolean(notForMe)}
                className={`flex-1 min-w-0 h-12 px-4 rounded-full text-body font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${
                  isPending ? 'bg-zine-card text-zine-ink' : ev.isJoined ? 'bg-zine-sage text-white' : isFull || notForMe ? 'bg-zine-card text-zine-inkMuted cursor-default' : 'bg-zine-terracotta text-white'
                }`}
              >
                {isFull ? (
                  'Мест нет'
                ) : notForMe ? (
                  <span className="truncate">{M.notForMe}</span>
                ) : isJoining ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : isPending ? (
                  <span>⏳ Заявка</span>
                ) : ev.isJoined ? (
                  <>
                    <Check size={20} strokeWidth={3} />
                    <span className="truncate">{ev.byRequest ? 'Записан(а)' : 'Я иду'}{ev.myGuests ? ` +${ev.myGuests}` : ''}{ev.myWithKids ? ' 👶' : ''}</span>
                  </>
                ) : ev.byRequest ? (
                  <span className="truncate">{M.requestJoin}</span>
                ) : (
                  'Пойду!'
                )}
              </button>
            </>
          )}
        </div>
        {/* Записан(а) — «Точно приду» и заметная отмена прямо на карточке */}
        {ev.isJoined && !isCreator && (
          <div className="mt-2 flex items-center justify-center gap-5">
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
              className="h-9 text-body font-bold text-zine-inkMuted underline underline-offset-4 decoration-zine-inkMuted cursor-pointer"
            >
              {M.notGoing}
            </button>
          </div>
        )}
      </div>
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

