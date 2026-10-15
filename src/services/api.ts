import { telegramService } from './telegram';
import { UserProfile, ActivityGoal } from '../types';

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

  /**
   * 1. Получить профиль текущего пользователя
   */
  async getMe(): Promise<any> {
    return this.request<any>('/users/me');
  }

  /**
   * 2. Подтверждение правил сервиса (онбординг "без дейтинга")
   */
  async agreeToRules(): Promise<{ success: boolean; user?: any }> {
    return this.request<{ success: boolean; user?: any }>('/users/agree-rules', {
      method: 'POST'
    });
  }

  /**
   * 3. Получить список пользователей рядом (/api/users/nearby)
   * С автоматическим фолбэком на /api/users/map для надежности
   */
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

  /**
   * 4. Создать / Обновить профиль пользователя (POST-запрос на /api/users/profile)
   */
  async updateProfile(data: {
    name?: string;
    firstName?: string;
    age?: number | string;
    bio?: string;
    goal?: ActivityGoal;
    goals?: ActivityGoal[];
    avatarUrl?: string;
    areaName?: string;
    coordinates?: [number, number];
    isProfileActive?: boolean;
  }): Promise<any> {
    try {
      return await this.request<any>('/users/profile', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (err: any) {
      // Фолбэк на PUT, если бэкенд настроен через PUT
      if (err.message?.includes('404')) {
        return await this.request<any>('/users/profile', {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
      throw err;
    }
  }
}

export const api = new ApiService();
