export type ActivityGoal = 'walk' | 'cafe_bar' | 'expo_cinema' | 'trip_outdoors';
export type Gender = 'male' | 'female' | 'not_specified';
export type PreferredGender = 'all' | 'male' | 'female';
export type EventCategory = 'walk' | 'cafe_bar' | 'expo_cinema' | 'trip_outdoors' | 'boardgames' | 'sport';

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
  trip_outdoors: { id: 'trip_outdoors', label: 'За город, природа', emoji: '🌲', ...badge('sage') }
};

export const EVENT_CATEGORIES_CONFIG: Record<EventCategory, { label: string; emoji: string; badgeBg: string; badgeText: string }> = {
  walk: { label: 'Прогулка', emoji: '🚶', ...badge('terracotta') },
  cafe_bar: { label: 'Кофе, бар', emoji: '☕️', ...badge('mustard') },
  expo_cinema: { label: 'Арт, кино', emoji: '🎨', ...badge('plum') },
  trip_outdoors: { label: 'За город', emoji: '🌲', ...badge('sage') },
  boardgames: { label: 'Настолки', emoji: '🎲', ...badge('sky') },
  sport: { label: 'Спорт, вело', emoji: '🚴', ...badge('sky') }
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
}

// Фильтр людей: по цели, все или «🧭 Покажут город»
export type GoalFilter = ActivityGoal | 'all' | 'guides';

export const matchesGoalFilter = (u: UserProfile, filter: GoalFilter) =>
  filter === 'all' ? true : filter === 'guides' ? Boolean(u.isGuide) : u.goal === filter;

// «⚡ Свободен сейчас» ещё действует?
export const isAvailableNow = (u?: { availableUntil?: string | null } | null) =>
  Boolean(u?.availableUntil && new Date(u.availableUntil).getTime() > Date.now());

export const formatTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  locationName: string;
  coordinates: [number, number]; // [lat, lng]
  dateTime: string;
  creator: {
    telegramId: number;
    name: string;
    username?: string;
    avatarUrl: string;
  };
  participantsCount: number;
  maxParticipants: number;
  isJoined: boolean;
  isOfficial?: boolean; // «⭐ От ДА! МИНСК» — сходка автора проекта
  participants?: Array<{
    telegramId: number;
    name: string;
    username?: string;
    avatarUrl: string;
  }>;
}

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

export interface PlaceItem {
  id: string;
  name: string;
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
}

export interface PlaceTipItem {
  id: string;
  name: string;
  avatarUrl: string;
  text: string;
  createdAt: string;
  isMine: boolean;
}
