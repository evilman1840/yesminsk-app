import { telegramService } from './telegram';
import { UserProfile, ActivityGoal, AppEvent, Gender, PreferredGender } from '../types';

/**
 * Нормализация базового URL бэкенда
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

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const initData = telegramService.getInitData();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      ...(options.headers as Record<string, string>)
    };

    const url = `${API_BASE_URL}${endpoint}`;

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
    goal?: ActivityGoal | 'all';
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
      return await this.request<UserProfile[]>(`/users/map${queryString}`);
    }
  }

  async getMapUsers(params?: {
    goal?: ActivityGoal | 'all';
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }): Promise<UserProfile[]> {
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

  /**
   * Заблокировать пользователя (черный список)
   */
  async blockUser(targetTelegramId: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/users/block', {
      method: 'POST',
      body: JSON.stringify({ targetTelegramId })
    });
  }

  /**
   * Разблокировать пользователя
   */
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

  async toggleJoinEvent(eventId: string, isCurrentlyJoined: boolean): Promise<any> {
    if (isCurrentlyJoined) {
      return this.leaveEvent(eventId);
    } else {
      return this.joinEvent(eventId);
    }
  }
}

export const api = new ApiService();
