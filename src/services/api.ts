import { telegramService } from './telegram';
import { UserProfile, ActivityGoal, AppEvent, Gender, PreferredGender } from '../types';

/**
 * Нормализация базового URL бэкенда.
 * Корректно работает как с https://site.onrender.com, так и с https://site.onrender.com/api
 */
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return 'http://localhost:4000/api';
  }
  const clean = envUrl.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const API_BASE_URL = getApiBaseUrl();

// Полный адрес файла на сервере (например, фото из новостей: /api/news/photo/…)
export const serverUrl = (path: string) => API_BASE_URL.replace(/\/api$/, '') + path;

export interface NewsItem {
  id: string;
  text: string;
  photos: string[];
  createdAt: string;
}

/**
 * Отслеживание «медленных» запросов. Бесплатный сервер на Render засыпает без нагрузки
 * и просыпается до минуты — в это время показываем пользователю доброе сообщение.
 */
const SLOW_REQUEST_MS = 2500;
let slowRequests = 0;
const slowListeners = new Set<(isSlow: boolean) => void>();
const notifySlow = () => slowListeners.forEach((fn) => fn(slowRequests > 0));

export const onServerWaking = (listener: (isWaking: boolean) => void) => {
  slowListeners.add(listener);
  return () => {
    slowListeners.delete(listener);
  };
};

class ApiService {
  /**
   * Универсальный метод отправки запросов с передачей Telegram initData в заголовках
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const initData = telegramService.getInitData();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      ...(options.headers as Record<string, string>)
    };

    const url = `${API_BASE_URL}${endpoint}`;

    let markedSlow = false;
    const slowTimer = setTimeout(() => {
      markedSlow = true;
      slowRequests++;
      notifySlow();
    }, SLOW_REQUEST_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка сервера (${response.status})`);
      }

      return await response.json();
    } catch (error: any) {
      console.warn(`[API] Ошибка запроса к ${url}:`, error.message);
      throw error;
    } finally {
      clearTimeout(slowTimer);
      if (markedSlow) {
        slowRequests--;
        notifySlow();
      }
    }
  }

  // ==========================================
  // ПОЛЬЗОВАТЕЛИ
  // ==========================================

  async getMe(): Promise<any> {
    return this.request<any>('/users/me');
  }

  async agreeToRules(): Promise<{ success: boolean; user?: any }> {
    return this.request<{ success: boolean; user?: any }>('/users/agree-rules', {
      method: 'POST'
    });
  }

  async getNearbyUsers(params?: {
    goal?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }): Promise<UserProfile[]> {
    const query = new URLSearchParams();
    if (params?.goal && params.goal !== 'all') query.set('goal', params.goal);
    if (params?.lat) query.set('lat', params.lat.toString());
    if (params?.lng) query.set('lng', params.lng.toString());
    if (params?.radiusKm) query.set('radiusKm', params.radiusKm.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';

    try {
      return await this.request<UserProfile[]>(`/users/nearby${queryString}`);
    } catch (err: any) {
      if (err.message?.includes('404')) {
        return await this.request<UserProfile[]>(`/users/map${queryString}`);
      }
      throw err;
    }
  }

  async getMapUsers(params?: { goal?: string; lat?: number; lng?: number; radiusKm?: number }): Promise<UserProfile[]> {
    return this.getNearbyUsers(params);
  }

  async updateProfile(data: {
    name?: string;
    firstName?: string;
    age?: number | string;
    gender?: Gender;
    preferredGender?: PreferredGender;
    preferredAgeRange?: { min: number; max: number };
    bio?: string;
    goal?: ActivityGoal;
    goals?: ActivityGoal[];
    avatarUrl?: string;
    areaName?: string;
    isTourist?: boolean;
    coordinates?: [number, number];
    isProfileActive?: boolean;
    isGuide?: boolean;
    guideAbout?: string;
  }): Promise<any> {
    try {
      return await this.request<any>('/users/profile', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (err: any) {
      if (err.message?.includes('404')) {
        return await this.request<any>('/users/profile', {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
      throw err;
    }
  }

  async blockUser(targetTelegramId: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/users/block', {
      method: 'POST',
      body: JSON.stringify({ blockedTelegramId: targetTelegramId, targetTelegramId })
    });
  }

  // ==========================================
  // ЛАЙКИ / ДИЗЛАЙКИ / МЭТЧИ
  // ==========================================

  async reactToUser(
    targetTelegramId: number,
    type: 'like' | 'dislike'
  ): Promise<{ success: boolean; isMatch: boolean; user?: UserProfile }> {
    return this.request('/reactions', {
      method: 'POST',
      body: JSON.stringify({ targetTelegramId, type })
    });
  }

  // Новости проекта (автор пишет их боту командой /news)
  async getNews(): Promise<NewsItem[]> {
    return this.request('/news');
  }

  // Ссылка на оплату звёздами Telegram
  async createDonateInvoice(stars: number): Promise<{ url: string }> {
    return this.request('/donate/invoice', {
      method: 'POST',
      body: JSON.stringify({ stars })
    });
  }

  // «⚡ Хочу сейчас»: hours > 0 — включить на столько часов, 0 — выключить
  async setAvailable(hours: number): Promise<{ success: boolean; availableUntil: string | null }> {
    return this.request('/users/available', {
      method: 'POST',
      body: JSON.stringify({ hours })
    });
  }

  async getInbox(): Promise<{ likedMe: UserProfile[]; matches: UserProfile[] }> {
    return this.request('/reactions/inbox');
  }

  async unblockUser(targetTelegramId: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/users/unblock', {
      method: 'POST',
      body: JSON.stringify({ targetTelegramId })
    });
  }

  // ==========================================
  // СОБЫТИЯ / СХОДКИ (EVENTS)
  // ==========================================

  async getEvents(params?: {
    category?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }): Promise<AppEvent[]> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.lat) query.set('lat', params.lat.toString());
    if (params?.lng) query.set('lng', params.lng.toString());
    if (params?.radiusKm) query.set('radiusKm', params.radiusKm.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<AppEvent[]>(`/events${queryString}`);
  }

  async createEvent(data: {
    title: string;
    description: string;
    category: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }): Promise<AppEvent> {
    return this.request<AppEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Обновить существующее событие (редактирование автором)
   */
  async updateEvent(eventId: string, data: {
    title?: string;
    description?: string;
    category?: string;
    locationName?: string;
    coordinates?: [number, number];
    dateTime?: string;
    maxParticipants?: number;
  }): Promise<AppEvent> {
    try {
      return await this.request<AppEvent>(`/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch (err: any) {
      // Резервный POST на случай блокировки PUT хостингом
      if (err.message?.includes('404')) {
        return await this.request<AppEvent>(`/events/${eventId}`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
      throw err;
    }
  }

  /**
   * Удалить событие (только автор)
   */
  async deleteEvent(eventId: string): Promise<{ success: boolean; message: string }> {
    try {
      return await this.request<{ success: boolean; message: string }>(`/events/${eventId}`, {
        method: 'DELETE'
      });
    } catch (err: any) {
      if (err.message?.includes('404')) {
        return await this.request<{ success: boolean; message: string }>(`/events/${eventId}/delete`, {
          method: 'POST'
        });
      }
      throw err;
    }
  }

  async joinEvent(eventId: string): Promise<{ success: boolean; event: AppEvent }> {
    return this.request<{ success: boolean; event: AppEvent }>(`/events/${eventId}/join`, {
      method: 'POST'
    });
  }

  async leaveEvent(eventId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/events/${eventId}/leave`, {
      method: 'POST'
    });
  }

  async toggleJoinEvent(eventId: string, isCurrentlyJoined?: boolean): Promise<any> {
    if (isCurrentlyJoined) {
      return this.leaveEvent(eventId);
    } else {
      return this.joinEvent(eventId);
    }
  }
}

export const api = new ApiService();
