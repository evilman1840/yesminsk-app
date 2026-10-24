export type ActivityGoal = 'walk' | 'cafe_bar' | 'expo_cinema' | 'trip_outdoors' | 'boardgames' | 'sport' | 'other';
export type Gender = 'male' | 'female' | 'not_specified';
export type PreferredGender = 'all' | 'male' | 'female';
export type EventCategory = 'walk' | 'cafe_bar' | 'expo_cinema' | 'trip_outdoors' | 'boardgames' | 'sport' | 'support' | 'other';

export interface AgeRange {
  min: number;
  max: number;
}

export interface GoalConfig {
  id: ActivityGoal;
  label: string;
  emoji: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

// Цвета бейджей построены на палитре и сами подстраиваются под светлую/тёмную тему.
// Классы записаны целиком, чтобы Tailwind их увидел
const BADGES = {
  terracotta: { badgeBg: 'bg-zine-terracotta/10', badgeText: 'text-zine-terracotta', badgeBorder: 'border-zine-terracotta/25' },
  mustard: { badgeBg: 'bg-zine-mustard/15', badgeText: 'text-zine-mustardInk', badgeBorder: 'border-zine-mustard/30' },
  plum: { badgeBg: 'bg-zine-plum/10', badgeText: 'text-zine-plum', badgeBorder: 'border-zine-plum/25' },
  sage: { badgeBg: 'bg-zine-sage/15', badgeText: 'text-zine-sage', badgeBorder: 'border-zine-sage/30' },
  sky: { badgeBg: 'bg-zine-sky/10', badgeText: 'text-zine-sky', badgeBorder: 'border-zine-sky/25' },
  blush: { badgeBg: 'bg-zine-blush/15', badgeText: 'text-zine-terracotta', badgeBorder: 'border-zine-blush/30' }
};
const badge = (color: keyof typeof BADGES) => BADGES[color];

export const GOALS_CONFIG: Record<ActivityGoal, GoalConfig> = {
  cafe_bar: { id: 'cafe_bar', label: 'Кафе или бар', emoji: '☕️', ...badge('mustard') },
  walk: { id: 'walk', label: 'Погулять по городу', emoji: '🚶', ...badge('terracotta') },
  expo_cinema: { id: 'expo_cinema', label: 'Выставка или кино', emoji: '🎨', ...badge('plum') },
  trip_outdoors: { id: 'trip_outdoors', label: 'За город, природа', emoji: '🌲', ...badge('sage') },
  boardgames: { id: 'boardgames', label: 'Настолки', emoji: '🎲', ...badge('sky') },
  sport: { id: 'sport', label: 'Спорт, вело', emoji: '🚴', ...badge('sky') },
  other: { id: 'other', label: 'Своя идея', emoji: '✨', ...badge('blush') }
};

// Цель для показа: у «Своей идеи» подпись берём ту, что вписал человек
export const goalOf = (goal: ActivityGoal, customGoal?: string): GoalConfig => {
  const cfg = GOALS_CONFIG[goal] || GOALS_CONFIG.walk;
  return goal === 'other' && customGoal?.trim() ? { ...cfg, label: customGoal.trim() } : cfg;
};

// Все цели человека (старые анкеты хранят только одну)
export const goalsOf = (u: { goal: ActivityGoal; goals?: ActivityGoal[]; customGoal?: string }) =>
  (u.goals?.length ? u.goals : [u.goal]).filter((g) => GOALS_CONFIG[g]).map((g) => goalOf(g, u.customGoal));

// Общие интересы со мной («Своя идея» не в счёт — у каждого она своя)
export const commonGoalIds = (u: { goal: ActivityGoal; goals?: ActivityGoal[] }, myGoals?: ActivityGoal[]) => {
  const mine = new Set<ActivityGoal>((myGoals || []).filter((g) => g !== 'other'));
  return (u.goals?.length ? u.goals : [u.goal]).filter((g) => mine.has(g));
};

export const EVENT_CATEGORIES_CONFIG: Record<EventCategory, { label: string; emoji: string; badgeBg: string; badgeText: string }> = {
  cafe_bar: { label: 'Кофе, бар', emoji: '☕️', ...badge('mustard') },
  walk: { label: 'Прогулка', emoji: '🚶', ...badge('terracotta') },
  expo_cinema: { label: 'Арт, кино', emoji: '🎨', ...badge('plum') },
  trip_outdoors: { label: 'За город', emoji: '🌲', ...badge('sage') },
  boardgames: { label: 'Настолки', emoji: '🎲', ...badge('sky') },
  sport: { label: 'Спорт, вело', emoji: '🚴', ...badge('sky') },
  support: { label: 'Поныть', emoji: '🫂', ...badge('blush') },
  other: { label: 'Своя идея', emoji: '✨', ...badge('blush') }
};

// Категория сходки для показа: у «Своей идеи» подпись берём ту, что вписал автор
export const eventCategoryOf = (ev: { category: EventCategory; customCategory?: string }) => {
  const cfg = EVENT_CATEGORIES_CONFIG[ev.category] || EVENT_CATEGORIES_CONFIG.walk;
  return ev.category === 'other' && ev.customCategory?.trim() ? { ...cfg, label: ev.customCategory.trim() } : cfg;
};

export interface UserProfile {
  id: string;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  avatarUrl: string;
  bio: string;
  goal: ActivityGoal;
  goals?: ActivityGoal[];
  customGoal?: string; // своя идея, когда среди целей есть 'other'
  goesWith?: GoesWith; // «Обычно хожу»
  isEmpath?: boolean;  // «🫶 Эмпат» — отметил(а) сам(а) в анкете
  ventUntil?: string;  // «🫂 Хочется поныть» — до этого времени (приходит только эмпатам)
  age: number;
  gender: Gender;
  preferredGender: PreferredGender;
  preferredAgeRange: AgeRange;
  coordinates: [number, number]; // [lat, lng]
  areaName?: string;
  isTourist?: boolean;
  hasAgreedToRules?: boolean;
  blockedUsers?: number[];
  distanceMeters?: number;
  lastActiveAt?: string;
  iLiked?: boolean;   // я нажал 👋 «Пообщаться»
  likedMe?: boolean;  // мне нажали 👋
  isMatch?: boolean;  // оба нажали 👋 — на связи, можно писать
  availableUntil?: string; // «⚡ Хочу сейчас» — до этого времени
  isGuide?: boolean;       // «🧭 Покажу город» — местный гид-волонтёр
  guideAbout?: string;     // что может показать
  activeRecently?: boolean; // заходил(а) за последние 3 дня
  photos?: string[];        // ещё до 5 фото в анкете (адреса на сервере)
}

// Фильтр людей: по цели, все или «🧭 Покажут город»
export type GoalFilter = ActivityGoal | 'all' | 'guides' | 'empaths';

export const matchesGoalFilter = (u: UserProfile, filter: GoalFilter) =>
  filter === 'all'
    ? true
    : filter === 'guides'
    ? Boolean(u.isGuide)
    : filter === 'empaths'
    ? Boolean(u.isEmpath)
    : (u.goals?.length ? u.goals : [u.goal]).includes(filter);

// «⚡ Свободен сейчас» ещё действует?
export const isAvailableNow = (u?: { availableUntil?: string | null } | null) =>
  Boolean(u?.availableUntil && new Date(u.availableUntil).getTime() > Date.now());

export const formatTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

// Сходки по времени: всё / сегодня / завтра / ближайшие выходные
export type EventWhen = 'all' | 'today' | 'tomorrow' | 'weekend';
export const EVENT_WHEN: [EventWhen, string][] = [
  ['all', 'Все'],
  ['today', 'Сегодня'],
  ['tomorrow', 'Завтра'],
  ['weekend', 'Выходные']
];

export const matchesWhen = (iso: string, when: EventWhen) => {
  if (when === 'all') return true;
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((d.getTime() - start.getTime()) / 86400000);
  if (when === 'today') return dayDiff === 0;
  if (when === 'tomorrow') return dayDiff === 1;
  // Ближайшие суббота и воскресенье (если сегодня выходной — эти же)
  const dow = start.getDay(); // 0 — воскресенье, 6 — суббота
  const toSat = dow === 0 ? -1 : 6 - dow;
  return dayDiff >= toSat && dayDiff <= toSat + 1 && dayDiff >= 0;
};

// Пометки организатора: для кого сходка
export type EventTag = 'kids' | 'couples' | 'dogs' | 'empaths';
export const EVENT_TAGS: Record<EventTag, { label: string; emoji: string }> = {
  couples: { label: 'Удобно парами', emoji: '💑' },
  dogs: { label: 'Можно с собакой', emoji: '🐕' },
  empaths: { label: 'Только эмпаты', emoji: '🫶' },
  kids: { label: 'Можно с детьми', emoji: '👶' }
};

// Как человек идёт на сходку: сколько ведёт с собой и есть ли дети
export interface JoinOptions {
  guests: number;
  withKids: boolean;
}

// «Эмпат»: значок и подпись — в одном месте, чтобы легко поменять
export const EMPATH = { emoji: '🫶', label: 'Эмпат' };

// «🫂 Хочется поныть» ещё действует?
export const isVentingNow = (u?: { ventUntil?: string | null } | null) =>
  Boolean(u?.ventUntil && new Date(u.ventUntil).getTime() > Date.now());

// Правила сходки «🫂 Поныть» — показываем на карточке и подтверждаем при записи
export const SUPPORT_RULES = ['Не осуждаем и не даём советов, если не просят', 'Слушаем по очереди', 'Что сказано здесь, остаётся здесь'];

// Куда обращаться, если совсем тяжело
export const HELP_PHONE = '133';
export const HELP_URL = 'https://clck.ru/3MuBz2';

// Подборки от бота: как часто присылать
export type DigestFrequency = 'daily' | 'weekend' | 'weekly' | 'off';
export const DIGEST_OPTIONS: Record<DigestFrequency, { label: string; hint: string; emoji: string }> = {
  daily: { label: 'Каждый день', hint: 'утром: что сегодня и завтра', emoji: '📅' },
  weekend: { label: 'На выходные', hint: 'в четверг вечером', emoji: '🎉' },
  weekly: { label: 'Раз в неделю', hint: 'в понедельник утром', emoji: '🗓' },
  off: { label: 'Не присылать', hint: 'загляну в приложение', emoji: '🔕' }
};

// Район «приезжий»: раньше был «Я турист(ка) / не знаю города» — такие анкеты тоже считаем приезжими
export const TOURIST_AREA = 'В Минске проездом / не знаю города';
export const isTouristArea = (area?: string) => /турист|проездом/i.test(area || '');

// «Обычно хожу» в анкете
export type GoesWith = 'solo' | 'couple' | 'friends' | 'kids';
export const GOES_WITH: Record<GoesWith, { label: string; emoji: string }> = {
  solo: { label: 'Без компании', emoji: '🙂' },
  couple: { label: 'Парой', emoji: '💑' },
  friends: { label: 'Компанией', emoji: '👯' },
  kids: { label: 'С детьми', emoji: '👨‍👩‍👧' }
};

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  customCategory?: string; // своя идея, когда category = 'other'
  tags?: EventTag[];
  locationName: string;
  coordinates: [number, number]; // [lat, lng]
  dateTime: string;
  creator: {
    telegramId: number;
    name: string;
    username?: string;
    avatarUrl: string;
  };
  participantsCount: number; // занятые места — вместе с гостями
  groupsCount?: number;      // сколько записей (человек со своими гостями — одна)
  withKidsCount?: number;    // сколько записей с детьми
  maxParticipants: number;
  isJoined: boolean;
  myGuests?: number;         // сколько я веду с собой
  myWithKids?: boolean;
  isOfficial?: boolean; // «⭐ От ДА! МИНСК» — сходка автора проекта
  placeId?: string;     // сходка в месте из «Мест»
  templateId?: string;  // по какому шаблону собрана
  durationMinutes?: number;
  extras?: Record<string, string>; // доп. поля шаблона: фильм, вид спорта, уровень…
  badges?: string[];    // метки из доп. полей: «🏓 Настольный теннис · любой уровень»
  photos?: string[];    // до 5 фото: адреса на сервере, первое — обложка
  participants?: Array<{
    telegramId: number;
    name: string;
    username?: string;
    avatarUrl: string;
    guests?: number;
    withKids?: boolean;
  }>;
}

// Что уходит на сервер при создании и изменении сходки
export interface EventPayload {
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
  templateId?: string;
  durationMinutes?: number;
  extras?: Record<string, string>;
  photos?: string[]; // id фото на сервере
}

// Шаблон сходки (правится автором в боте через /templates)
export interface TemplateOption {
  value: string;
  label: string;
  emoji?: string;
  badge?: string;
  say?: string;
  seatsHint?: boolean;
}
export interface TemplateField {
  key: string;
  token?: string;
  label: string;
  type: 'select' | 'text' | 'money';
  required?: boolean;
  placeholder?: string;
  default?: string;
  options?: TemplateOption[];
  allowCustom?: boolean;
  customLabel?: string;
  freeLabel?: string;
  amountLabel?: string;
}
export interface EventTemplate {
  key: string;
  emoji: string;
  name: string;
  category: EventCategory | null;
  title: string;
  fallbackTitle: string;
  description: string;
  seats: number;
  durationMinutes: number;
  placeTypes: string[];
  tags: EventTag[];
  fields: TemplateField[];
}
export const CUSTOM_TEMPLATE = 'custom';

// Открыть форму сходки уже заполненной: место, шаблон, время (today / tomorrow / saturday / sunday / weekend)
export interface MeetupPlace {
  name: string;
  coordinates: [number, number];
  placeId?: string;
  placeType?: string; // тип места: под него подбираются шаблоны
}
// Откуда открыли форму сходки — для воронки в /stats
export type MeetupFormSource = 'feed' | 'empty' | 'place' | 'link';
export interface MeetupCreateRequest {
  place?: MeetupPlace;
  template?: string;
  when?: string;
  source?: MeetupFormSource;
}

// Сколько ещё можно взять с собой: свободные места минус я сам (моя прошлая запись не в счёт)
export const maxGuestsFor = (ev: AppEvent) => {
  if (!ev.maxParticipants) return Infinity;
  const mySeats = ev.isJoined ? 1 + (ev.myGuests || 0) : 0;
  return Math.max(0, ev.maxParticipants - (ev.participantsCount - mySeats) - 1);
};

// «+1, с детьми» — как я иду
export const companyNote = (guests = 0, withKids = false) =>
  [guests > 0 ? `+${guests}` : '', withKids ? 'с детьми' : ''].filter(Boolean).join(', ');

/* ---------- Места по вайбу ---------- */

// Настроения — те же, что рубрики блога yesminsk.com
export type PlaceMood = 'tosku' | 'escape' | 'wow' | 'love' | 'party' | 'solo' | 'food';

export const PLACE_MOODS: Record<PlaceMood, { label: string; emoji: string; blog: string }> = {
  tosku: { label: 'Разогнать тоску', emoji: '🌤', blog: 'https://yesminsk.com/razognat-tosku-minsk/' },
  escape: { label: 'Сбежать от всех', emoji: '🤫', blog: 'https://yesminsk.com/sbezhat-ot-vseh-minsk/' },
  wow: { label: 'Поймать восторг', emoji: '🤩', blog: 'https://yesminsk.com/poymat-vostorg-minsk/' },
  love: { label: 'Влюбиться в Минск', emoji: '💛', blog: 'https://yesminsk.com/vlyubitsya-v-minsk/' },
  party: { label: 'Оторваться компанией', emoji: '🎉', blog: 'https://yesminsk.com/otorvatsya-kompaniey-minsk/' },
  solo: { label: 'Еду соло', emoji: '🎒', blog: 'https://yesminsk.com/edu-solo-minsk/' },
  food: { label: 'Накормить душу', emoji: '🥞', blog: 'https://yesminsk.com/nakormit-dushu-minsk/' }
};

export const PLACE_PRICES: Record<'free' | 'cheap' | 'mid', string> = {
  free: '💸 Бесплатно',
  cheap: '💸 Недорого',
  mid: '💸💸 Средне'
};

// Типы мест — те же, что автор выбирает в боте
export const PLACE_TYPES: Record<string, string> = {
  Архитектура: '🏛',
  Галерея: '🖼',
  Достопримечательность: '📸',
  Зоопарк: '🦒',
  Исторический: '🏰',
  Культурный: '🎨',
  Мемориал: '🕯',
  Музей: '🏺',
  Памятник: '🗿',
  Парк: '🌳',
  Площадь: '⛲',
  Развлечения: '🎡',
  Скульптура: '🗽',
  Смотровая: '🔭',
  Театр: '🎭',
  Храм: '⛪',
  Кафе: '🍽',
  Кофейня: '☕',
  Кинотеатр: '🎬',
  Антикафе: '🎲',
  Спорт: '🏓',
  Сквер: '🌿'
};
export const placeTypeEmoji = (category?: string) => (category && PLACE_TYPES[category]) || '📍';

// «3 442 оценки» — с пробелом в тысячах и правильным окончанием
export const formatRatingCount = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'оценка' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'оценки' : 'оценок';
  return `${n.toLocaleString('ru-RU')} ${word}`;
};

// Куда с детьми
export type KidsLevel = 'top' | 'age' | 'nearby';
export const KIDS_LEVELS: Record<KidsLevel, { label: string; short: string; tiny: string; order: number }> = {
  top: { label: 'Отлично с детьми, стоит ехать специально', short: 'Отлично с детьми', tiny: 'топ для детей', order: 0 },
  age: { label: 'С детьми, смотря какой возраст', short: 'С детьми постарше', tiny: 'детям постарше', order: 1 },
  nearby: { label: 'Можно с детьми, если живёшь рядом', short: 'Можно с детьми', tiny: 'можно с детьми', order: 2 }
};

// Места для фильтра «👶 С детьми»: сначала лучшие
export const placesForKids = <T extends { kidsLevel?: KidsLevel | null }>(places: T[]) =>
  places.filter((p) => p.kidsLevel).sort((a, b) => KIDS_LEVELS[a.kidsLevel!].order - KIDS_LEVELS[b.kidsLevel!].order);

export interface PlaceItem {
  id: string;
  name: string;
  category: string; // достопримечательность, кафе, парк…
  description: string;
  moods: PlaceMood[];
  photos: string[]; // пути на сервере: /api/places/photo/…
  address: string;
  coordinates: [number, number]; // [lat, lng]
  mishaTip: string;
  blogUrl: string;
  mapUrl: string;   // ссылка на Яндекс Карты (отзывы и фото)
  isSaved: boolean; // 🔖 в моём списке «хочу сходить»
  price: 'free' | 'cheap' | 'mid' | null;
  rainOk: boolean;
  evening: boolean;
  oneDay: boolean;
  tipsCount: number;
  // Из Яндекс Карт
  rating?: number | null;
  ratingCount?: number | null;
  hours?: string;
  phone?: string;
  website?: string;
  amenities?: string[];
  reviews?: { rating: number | null; text: string; source: string }[]; // отзывы с Яндекс Карт из таблиц автора
  kidsLevel?: KidsLevel | null;
  kidsNote?: string;
  savedByOthers?: number; // сколько ещё людей сохранили место
}

// Место из «Мест» → место для формы сходки
export const placeForMeetup = (p: PlaceItem): MeetupPlace => ({
  name: p.address && p.address !== p.name ? `${p.name}, ${p.address}` : p.name,
  coordinates: p.coordinates,
  placeId: p.id,
  placeType: p.category
});

export interface PlaceTipItem {
  id: string;
  name: string;
  avatarUrl: string;
  text: string;
  createdAt: string;
  isMine: boolean;
}
