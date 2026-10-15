export type ActivityGoal = 'walk' | 'cafe_bar' | 'expo_cinema' | 'trip_outdoors';
export type Gender = 'male' | 'female' | 'not_specified';
export type PreferredGender = 'all' | 'male' | 'female';
export type EventCategory = 'walk' | 'cafe_bar' | 'expo_cinema' | 'trip_outdoors' | 'boardgames' | 'sport';

export interface GoalConfig {
  id: ActivityGoal;
  label: string;
  emoji: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const GOALS_CONFIG: Record<ActivityGoal, GoalConfig> = {
  walk: {
    id: 'walk',
    label: 'Погулять по городу',
    emoji: '🚶‍♂️',
    badgeBg: 'bg-[#F9ECE7]',
    badgeText: 'text-zine-terracotta',
    badgeBorder: 'border-[#F2D4C9]'
  },
  cafe_bar: {
    id: 'cafe_bar',
    label: 'Сходить в бар / кафе',
    emoji: '☕️',
    badgeBg: 'bg-[#FAF4E6]',
    badgeText: 'text-[#B87C24]',
    badgeBorder: 'border-[#F3E2B8]'
  },
  expo_cinema: {
    id: 'expo_cinema',
    label: 'Выставка / Кино',
    emoji: '🎨',
    badgeBg: 'bg-[#FBECE8]',
    badgeText: 'text-[#C9533B]',
    badgeBorder: 'border-[#F6D5CD]'
  },
  trip_outdoors: {
    id: 'trip_outdoors',
    label: 'За город / Природа',
    emoji: '🌲',
    badgeBg: 'bg-[#EDF3EF]',
    badgeText: 'text-zine-sage',
    badgeBorder: 'border-[#D4E4D9]'
  }
};

export const EVENT_CATEGORIES_CONFIG: Record<EventCategory, { label: string; emoji: string; badgeBg: string; badgeText: string }> = {
  walk: { label: 'Прогулка', emoji: '🚶‍♂️', badgeBg: 'bg-[#F9ECE7]', badgeText: 'text-zine-terracotta' },
  cafe_bar: { label: 'Кофе / Бар', emoji: '☕️', badgeBg: 'bg-[#FAF4E6]', badgeText: 'text-[#B87C24]' },
  expo_cinema: { label: 'Арт / Кино', emoji: '🎨', badgeBg: 'bg-[#FBECE8]', badgeText: 'text-[#C9533B]' },
  trip_outdoors: { label: 'За город', emoji: '🌲', badgeBg: 'bg-[#EDF3EF]', badgeText: 'text-zine-sage' },
  boardgames: { label: 'Настолки', emoji: '🎲', badgeBg: 'bg-[#F0EBF8]', badgeText: 'text-[#6A4E9E]' },
  sport: { label: 'Спорт / Вело', emoji: '🚴‍♂️', badgeBg: 'bg-[#EAF3FA]', badgeText: 'text-[#3B729E]' }
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
  age: number;
  gender: Gender;
  preferredGender: PreferredGender;
  preferredAgeRange: {
    min: number;
    max: number;
  };
  coordinates: [number, number]; // [lat, lng]
  areaName?: string;
  isTourist?: boolean;
  hasAgreedToRules?: boolean;
  blockedUsers?: number[];
  distanceMeters?: number;
  lastActiveAt?: string;
}

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
  participants?: Array<{
    telegramId: number;
    name: string;
    username?: string;
    avatarUrl: string;
  }>;
}
