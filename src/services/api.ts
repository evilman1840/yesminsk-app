import { telegramService } from './telegram';
import { UserProfile, ActivityGoal } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const initData = telegramService.getInitData();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      ...(options.headers as Record<string, string>)
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`[API] Ошибка запроса к ${endpoint}:`, error);
      throw error;
    }
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me');
  }

  async agreeToRules(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/users/agree-rules', {
      method: 'POST'
    });
  }

  async getMapUsers(params?: {
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
    return this.request<UserProfile[]>(`/users/map${queryString}`);
  }

  async updateProfile(data: {
    name?: string;
    age?: number;
    bio?: string;
    goal?: ActivityGoal;
    areaName?: string;
    coordinates?: [number, number];
    isProfileActive?: boolean;
  }): Promise<UserProfile> {
    return this.request<UserProfile>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

export const api = new ApiService();
