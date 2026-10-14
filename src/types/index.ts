export type ActivityGoal = 'walk' | 'cafe_bar' | 'expo_cinema' | 'trip_outdoors';

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

export interface UserProfile {
  id: string;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  avatarUrl: string;
  bio: string;
  goal: ActivityGoal;
  coordinates: [number, number]; // [lat, lng]
  areaName?: string;
  distanceMeters?: number;
}
