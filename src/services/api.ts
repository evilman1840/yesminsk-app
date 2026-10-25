import { telegramService } from './telegram';
import { UserProfile, ActivityGoal, AppEvent, Gender, PreferredGender, PlaceItem, PlaceTipItem, EventPayload, EventTemplate, MeetupFormSource, WishItem, WishSummaryItem, WishWindow } from '../types';

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
        const err: any = new Error(errorData.error || `Ошибка сервера (${response.status})`);
        err.status = response.status;
        throw err;
      }

      if (response.status === 204) return undefined as T; // ответ без тела
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

  // Сколько анкет видно всего (на карту приходят только самые активные)
  async getNearbyCount(): Promise<number> {
    const r = await this.request<{ total: number }>('/users/nearby-count');
    return Number(r?.total) || 0;
  }

  async getMapUsers(params?: { goal?: string; lat?: number; lng?: number; radiusKm?: number }): Promise<UserProfile[]> {
    return this.getNearbyUsers(params);
  }

  // Своя метка на карте: точка, где тебя видят другие; null — вернуть случайное смещение 500-800 м
  async setShownLocation(coordinates: [number, number] | null): Promise<{ shownCoordinates: [number, number]; locationManual: boolean }> {
    return this.request('/users/shown-location', { method: 'POST', body: JSON.stringify(coordinates ? { coordinates } : { reset: true }) });
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
    customGoal?: string;
    goesWith?: string;
    digest?: string;
    isEmpath?: boolean;
    avatarUrl?: string;
    areaName?: string;
    isTourist?: boolean;
    coordinates?: [number, number];
    isProfileActive?: boolean;
    isGuide?: boolean;
    guideAbout?: string;
    photos?: string[];
    ageConfirmed?: boolean;
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

  // «Пропустить» свайпом: вернётся через 3 дня; undo — вернуть сразу
  async skipUser(telegramId: number, undo = false): Promise<void> {
    await this.request(`/users/${telegramId}/skip`, { method: 'POST', body: JSON.stringify({ undo }) });
  }

  async reactToUser(
    targetTelegramId: number,
    type: 'like' | 'dislike'
  ): Promise<{ success: boolean; isMatch: boolean; user?: UserProfile }> {
    return this.request('/reactions', {
      method: 'POST',
      body: JSON.stringify({ targetTelegramId, type })
    });
  }

  // Места по вайбу и советы людей к ним
  async getPlaces(): Promise<PlaceItem[]> {
    return this.request('/places');
  }

  // 🔖 Сохранить место / убрать из сохранённых
  async toggleSavePlace(placeId: string): Promise<{ saved: boolean }> {
    return this.request(`/places/${placeId}/save`, { method: 'POST' });
  }

  // Места, скрытые «Неинтересно» — для списка в анкете
  async getHiddenPlaces(): Promise<PlaceItem[]> {
    return this.request('/places/hidden');
  }

  // «Неинтересно»: скрыть место из ленты (hidden = false — вернуть)
  async hidePlace(placeId: string, hidden = true): Promise<{ hidden: boolean }> {
    return this.request(`/places/${placeId}/hide`, { method: 'POST', body: JSON.stringify({ hidden }) });
  }

  // Сходки, скрытые «Неинтересно» — для списка в анкете
  async getHiddenEvents(): Promise<AppEvent[]> {
    return this.request('/events/hidden');
  }

  // «Неинтересно»: скрыть сходку из ленты (hidden = false — вернуть)
  async hideEvent(eventId: string, hidden = true): Promise<{ hidden: boolean }> {
    return this.request(`/events/${eventId}/hide`, { method: 'POST', body: JSON.stringify({ hidden }) });
  }

  async getPlaceTips(placeId: string): Promise<PlaceTipItem[]> {
    return this.request(`/places/${placeId}/tips`);
  }

  async addPlaceTip(placeId: string, text: string): Promise<{ success: boolean; tip: PlaceTipItem }> {
    return this.request(`/places/${placeId}/tips`, { method: 'POST', body: JSON.stringify({ text }) });
  }

  async deletePlaceTip(tipId: string): Promise<{ success: boolean }> {
    return this.request(`/places/tips/${tipId}/delete`, { method: 'POST' });
  }

  // Жалоба на анкету или сходку — уходит модератору
  async report(targetType: 'user' | 'event', targetId: string | number, reason: string, comment: string) {
    return this.request<{ success: boolean }>('/reports', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, reason, comment })
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
  // «🫂 Хочется поныть» на несколько часов (0 — выключить)
  async setVent(hours: number): Promise<{ success: boolean; ventUntil: string | null }> {
    return this.request('/users/vent', { method: 'POST', body: JSON.stringify({ hours }) });
  }

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

  // Фото сходки или анкеты: сжатое фото → id на сервере
  async uploadPhoto(dataUrl: string): Promise<{ id: string }> {
    const res = await this.request<{ id: string }>('/photos', { method: 'POST', body: JSON.stringify({ dataUrl }) });
    if (!res?.id) throw new Error('upload failed');
    return res;
  }

  // Воронка формы «Собрать сходку»: шаги без ожидания ответа
  trackMeetupForm(data: {
    sessionId: string;
    step: 'opened' | 'template' | 'published' | 'closed' | 'error';
    template?: string;
    source?: MeetupFormSource;
    closedAt?: 'pick' | 'form';
    missing?: string[];
    error?: string;
  }) {
    this.request('/metrics/meetup-form', { method: 'POST', body: JSON.stringify(data) }).catch(() => {});
  }

  // «Написать участникам»: бот перешлёт сообщение организатора всем, кто записан
  async messageEventParticipants(eventId: string, text: string): Promise<{ sent: number; total: number }> {
    return this.request(`/events/${eventId}/message`, { method: 'POST', body: JSON.stringify({ text }) });
  }

  // «Предложи место»: ссылка из Яндекс Карт или название с адресом
  async suggestPlace(text: string, category?: string, context?: string): Promise<{ ok: boolean; name: string }> {
    return this.request('/places/suggest', { method: 'POST', body: JSON.stringify({ text, category, context }) });
  }

  // Человек разрешил боту писать — бот пришлёт приветствие, чтобы появился диалог
  async reportBotAccess(allowed: boolean): Promise<void> {
    await this.request('/users/bot-access', { method: 'POST', body: JSON.stringify({ allowed }) });
  }

  // Удалить себя из приложения
  async deleteAccount(): Promise<void> {
    await this.request('/users/me', { method: 'DELETE' });
  }

  // Одна анкета по ссылке из сообщения бота
  async getPublicUser(telegramId: number | string): Promise<UserProfile> {
    return this.request<UserProfile>(`/users/${telegramId}/public`);
  }
  // «Кто ещё хочет»: участники группы совпадения
  async getWishGroupMembers(groupId: string): Promise<{ members: UserProfile[]; eventId: string | null; askingPlace?: boolean; placeName?: string | null }> {
    return this.request(`/wishes/groups/${groupId}/members`);
  }

  // Предложить место группе «Хочу сходить»: бот сразу разошлёт всем место и варианты времени
  async suggestGroupPlace(groupId: string, text: string): Promise<{ ok: boolean; message: string }> {
    return this.request(`/wishes/groups/${groupId}/place`, { method: 'POST', body: JSON.stringify({ text }) });
  }

  // «Хочу сходить»
  async getWishes(): Promise<{ mine: WishItem[]; summary: WishSummaryItem[]; maxActive: number }> {
    return this.request('/wishes');
  }
  async createWish(data: { kind: string; sport?: string | null; timeWindow: WishWindow; placeId?: string | null }): Promise<{ wish: WishItem; sameCount: number }> {
    return this.request('/wishes', { method: 'POST', body: JSON.stringify(data) });
  }
  async cancelWish(id: string): Promise<void> {
    await this.request(`/wishes/${id}`, { method: 'DELETE' });
  }

  // Шаблоны сходок: «Кофе и поболтать», «Кино»…
  async getEventTemplates(): Promise<EventTemplate[]> {
    return this.request<EventTemplate[]>('/event-templates');
  }

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

  async createEvent(data: EventPayload): Promise<AppEvent> {
    return this.request<AppEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Обновить существующее событие (редактирование автором)
   */
  async updateEvent(eventId: string, data: Partial<EventPayload>): Promise<AppEvent> {
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

  // Записаться или поменять, с кем идёшь (повторный вызов обновляет запись)
  async joinEvent(eventId: string, options: { guests: number; withKids: boolean } = { guests: 0, withKids: false }): Promise<{ success: boolean; event: AppEvent }> {
    return this.request<{ success: boolean; event: AppEvent }>(`/events/${eventId}/join`, {
      method: 'POST',
      body: JSON.stringify(options)
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
