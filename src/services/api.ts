import { telegramService } from './telegram';
import type { GameView, GameLobby, GameSummary, TractorMatchResult } from '../games/types';
import { UserProfile, ActivityGoal, AppEvent, Gender, PreferredGender, PlaceItem, PlaceTipItem, EventPayload, EventTemplate, MeetupFormSource, WishItem, WishSummaryItem, WishWindow, PollData, MeetupStats } from '../types';

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

// «👯 Пойдём на сходку вместе»
export interface BuddyPerson {
  telegramId: number;
  firstName: string;
  age?: number;
  areaName?: string;
  avatarUrl: string;
  invited?: string | null; // уже звали на эту сходку: pending, accepted, declined, expired, undelivered
}
export interface BuddyOptions {
  friend: BuddyPerson;
  events: (AppEvent & { bothLike?: boolean })[];
  wishes: { kind: string; sport: string | null; what: string; when: string; timeWindow: WishWindow }[];
  left: number;
  limit: number;
}
export interface EventBuddies {
  people: BuddyPerson[];
  left: number;
  limit: number;
  closed?: string | null; // почему звать сюда нельзя (сходка скоро, на двоих, мест не хватает)
}

export interface NewsItem {
  id: string;
  text: string;
  photos: string[];
  createdAt: string;
}

// Донаты: шкала (/fund), переводы приютам (/sent) и кофе организаторам (/coffee)
export interface Fund {
  total: number;
  community: number;
  sent?: number;
  coffee?: number;
  lastTransfer?: { amount: number; to: string; at: string } | null;
  month?: { name: string; raised: number; goal: number }; // цель месяца (/goal), собрано с 1-го числа
  people?: number; // сколько человек уже поддержали (/fund)
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
  // quiet — долгий запрос нормален (опрос игры ждёт хода соперника): не показываем «сервер просыпается»
  private async request<T>(endpoint: string, options: RequestInit = {}, quiet = false): Promise<T> {
    const initData = telegramService.getInitData();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      ...(options.headers as Record<string, string>)
    };

    const url = `${API_BASE_URL}${endpoint}`;

    let markedSlow = false;
    const slowTimer = setTimeout(() => {
      if (quiet) return;
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
        err.data = errorData; // например, партия в ответ на «ход не засчитан»
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

  async agreeToRules(legalVersion?: string): Promise<{ success: boolean; user?: any }> {
    return this.request<{ success: boolean; user?: any }>('/users/agree-rules', {
      method: 'POST',
      body: JSON.stringify({ legalVersion })
    });
  }

  // Принять новую редакцию Соглашения и Политики (для уже зарегистрированных)
  async acceptLegal(version: string): Promise<void> {
    await this.request('/users/accept-legal', { method: 'POST', body: JSON.stringify({ version }) });
  }

  async getNearbyUsers(params?: {
    goal?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    filters?: Record<string, string>;
    offset?: number;
  }): Promise<UserProfile[]> {
    const query = new URLSearchParams(params?.filters);
    if (params?.goal && params.goal !== 'all') query.set('goal', params.goal);
    if (params?.offset) query.set('offset', String(params.offset));
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
  // С фильтрами — сколько людей под них подходит (для «Показать (N)» в шторке)
  async getNearbyCount(params?: { goal?: string; filters?: Record<string, string> }): Promise<{ total: number; all: number }> {
    const query = new URLSearchParams(params?.filters);
    if (params?.goal && params.goal !== 'all') query.set('goal', params.goal);
    const qs = query.toString();
    const r = await this.request<{ total: number; all?: number }>(`/users/nearby-count${qs ? `?${qs}` : ''}`);
    return { total: Number(r?.total) || 0, all: Number(r?.all) || 0 };
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
    photoOnly?: boolean;
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
    genderConfirmed?: boolean;
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

  // «Отменить» в «На связи»: снять свой 👋
  async unmatchUser(targetTelegramId: number): Promise<void> {
    await this.request('/reactions/unmatch', { method: 'POST', body: JSON.stringify({ targetTelegramId }) });
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
  // Шкала донатов: всего собрано и сколько из этого в котёл для пользователей (автор обновляет через /fund),
  // переводы приютам (/sent) и сколько кофе разыграли организаторам
  async getFund(): Promise<Fund> {
    return this.request('/fund');
  }

  // Экран «Спасибо» после перевода: значок в анкете и разрешение сказать спасибо по имени
  async sendDonateThanks(badge: boolean, thanks: boolean): Promise<{ success: boolean }> {
    return this.request('/fund/thanks', { method: 'POST', body: JSON.stringify({ badge, thanks }) });
  }

  async getNews(): Promise<NewsItem[]> {
    return this.request('/news');
  }

  // Короткая запись автора для строки подсказок (/tip — в конце, /tiptop — первой) или null
  async getTip(): Promise<{ id: string; text: string; first?: boolean } | null> {
    return this.request('/tip');
  }

  // Опрос автора (или null) — итоги приходят только после своего голоса
  async getPoll(): Promise<PollData | null> {
    return this.request('/poll');
  }

  async votePoll(pollId: string, options: string[], custom?: string): Promise<PollData> {
    return this.request('/poll/vote', { method: 'POST', body: JSON.stringify({ pollId, options, custom }) });
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
  // Карточки, которые уже посмотрели в «Людях» — сервер опустит их ниже
  async markPeopleSeen(ids: number[]): Promise<void> {
    await this.request('/users/seen', { method: 'POST', body: JSON.stringify({ ids }) });
  }

  // «Тоже хотят»: все с таким же желанием и моя группа совпадения
  // window и placeId — из счётчика «76 человек хотят на кофе на неделе»: только это окно и место
  async getWishKindPeople(
    kind: string,
    sport?: string,
    exact?: { window?: string; placeId?: string | null }
  ): Promise<{ kind: string; name: string; emoji: string; people: UserProfile[]; wishGroupId: string | null; eventId: string | null }> {
    const q = new URLSearchParams();
    if (sport) q.set('sport', sport);
    if (exact?.window) q.set('window', exact.window);
    if (exact?.placeId) q.set('placeId', exact.placeId);
    const qs = q.toString();
    return this.request(`/wishes/kind/${encodeURIComponent(kind)}/people${qs ? `?${qs}` : ''}`);
  }

  async getWishGroupMembers(groupId: string): Promise<{ members: UserProfile[]; eventId: string | null; askingPlace?: boolean; placeName?: string | null }> {
    return this.request(`/wishes/groups/${groupId}/members`);
  }

  // Предложить место группе «Хочу сходить»: бот сразу разошлёт всем место и варианты времени
  async suggestGroupPlace(groupId: string, text: string): Promise<{ ok: boolean; message: string }> {
    return this.request(`/wishes/groups/${groupId}/place`, { method: 'POST', body: JSON.stringify({ text }) });
  }

  // «Хочу сходить»
  async getWishes(): Promise<{ mine: WishItem[]; summary: WishSummaryItem[]; kindCounts?: Record<string, number>; maxActive: number; proposeAt?: number; stats?: MeetupStats }> {
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

  // Модератор удаляет чужую сходку; reason — его текст организатору
  async adminDeleteEvent(eventId: string, reason: string): Promise<{ success: boolean }> {
    return this.request(`/events/${eventId}/delete`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  // «👯 Пойдём на сходку вместе»: куда позвать знакомого из «На связи»
  async getBuddyOptions(friendId: number): Promise<BuddyOptions> {
    return this.request(`/buddies/${friendId}/options`);
  }

  // «👯 Позвать с собой» в карточке сходки: кого из «На связи» можно позвать
  async getEventBuddies(eventId: string): Promise<EventBuddies> {
    return this.request(`/events/${eventId}/buddies`);
  }

  async sendBuddyInvite(eventId: string, toId: number, source: 'people' | 'event'): Promise<{ delivered: boolean; warning?: string; event: AppEvent; left: number }> {
    return this.request('/buddies/invite', { method: 'POST', body: JSON.stringify({ eventId, toId, source }) });
  }

  // Записаться или поменять, с кем идёшь (повторный вызов обновляет запись)
  async joinEvent(eventId: string, options: { guests: number; withKids: boolean } = { guests: 0, withKids: false }): Promise<{ success: boolean; event: AppEvent }> {
    return this.request<{ success: boolean; event: AppEvent }>(`/events/${eventId}/join`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  // via: 'bot' — отменили по кнопке «Отменить» из сообщения бота (сервер запоминает, кто и откуда отменил)
  async leaveEvent(eventId: string, via: 'app' | 'bot' = 'app'): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/events/${eventId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ via })
    });
  }

  // Организатор отказывает участнику; reason — по желанию, уйдёт человеку в бот
  async removeParticipant(eventId: string, telegramId: number, reason: string): Promise<AppEvent> {
    return this.request<AppEvent>(`/events/${eventId}/remove`, { method: 'POST', body: JSON.stringify({ telegramId, reason }) });
  }

  // «По записи»: организатор подтверждает запись и/или меняет, сколько человек
  async updateParticipant(eventId: string, telegramId: number, data: { approve?: boolean; people?: number }): Promise<AppEvent> {
    return this.request<AppEvent>(`/events/${eventId}/participant`, { method: 'POST', body: JSON.stringify({ telegramId, ...data }) });
  }

  // Организатор отмечает «Не пришёл(ла)» (или снимает отметку)
  async markNoShow(eventId: string, telegramId: number, noShow: boolean): Promise<AppEvent> {
    return this.request<AppEvent>(`/events/${eventId}/noshow`, { method: 'POST', body: JSON.stringify({ telegramId, noShow }) });
  }

  // «✅ Точно приду»
  async confirmEvent(eventId: string): Promise<AppEvent> {
    return this.request<AppEvent>(`/events/${eventId}/confirm`, { method: 'POST' });
  }

  async toggleJoinEvent(eventId: string, isCurrentlyJoined?: boolean): Promise<any> {
    if (isCurrentlyJoined) {
      return this.leaveEvent(eventId);
    } else {
      return this.joinEvent(eventId);
    }
  }

  // ==========================================
  // МИНИ-ИГРЫ
  // ==========================================

  // Встать в поиск случайного соперника (или вернуться в уже идущую партию)
  async gameSearch(incognito: boolean): Promise<GameView> {
    return this.request<GameView>('/games/search', { method: 'POST', body: JSON.stringify({ incognito }) });
  }

  async gameInvite(incognito: boolean): Promise<GameView> {
    return this.request<GameView>('/games/invite', { method: 'POST', body: JSON.stringify({ incognito }) });
  }

  async gameJoin(code: string, incognito: boolean): Promise<GameView> {
    return this.request<GameView>(`/games/join/${encodeURIComponent(code)}`, { method: 'POST', body: JSON.stringify({ incognito }) });
  }

  async gameMine(): Promise<GameView[]> {
    return this.request<GameView[]>('/games/mine');
  }

  // wait — долгий опрос: сервер ответит, когда в партии что-то поменяется после версии since (или через 25 секунд)
  async gameGet(id: string, opts: { since?: number; wait?: boolean; signal?: AbortSignal } = {}): Promise<GameView> {
    const q = opts.wait ? `?wait=1&since=${opts.since ?? 0}` : '';
    return this.request<GameView>(`/games/${id}${q}`, { signal: opts.signal }, Boolean(opts.wait));
  }

  // Сыграли с ботом — для статистики автора и своих побед
  gameBotPlayed(won: boolean): void {
    this.request('/games/bot-played', { method: 'POST', body: JSON.stringify({ won }) }).catch(() => {});
  }

  // Мои победы и рекорды в играх, рейтинг дня по трактору
  async gameSummary(): Promise<GameSummary> {
    return this.request<GameSummary>('/games/summary', {}, true);
  }

  // «Трактор в Минске»: матч закончился. В ответ — свежая сводка с местом в рейтинге дня
  async tractorMatch(result: TractorMatchResult): Promise<GameSummary> {
    return this.request<GameSummary>('/games/tractor/match', { method: 'POST', body: JSON.stringify(result) });
  }

  async gameMove(id: string, cell: number): Promise<GameView> {
    return this.request<GameView>(`/games/${id}/move`, { method: 'POST', body: JSON.stringify({ cell }) });
  }

  async gameSay(id: string, say: string): Promise<GameView> {
    return this.request<GameView>(`/games/${id}/say`, { method: 'POST', body: JSON.stringify({ say }) });
  }

  // keepalive — запрос дойдёт, даже если приложение закрывают прямо сейчас
  async gameLeave(id: string, keepalive = false): Promise<GameView> {
    return this.request<GameView>(`/games/${id}/leave`, { method: 'POST', keepalive }, keepalive);
  }

  // Меню игр: сколько людей ищут и играют, звать ли меня
  async gameLobby(): Promise<GameLobby> {
    return this.request<GameLobby>('/games/lobby', {}, true);
  }

  async gameNotify(on: boolean): Promise<{ notify: boolean }> {
    return this.request('/games/notify', { method: 'POST', body: JSON.stringify({ on }) });
  }

  // Свернул приложение: если не вернёшься за 15 секунд, партия закроется
  async gameAway(id: string): Promise<void> {
    await this.request(`/games/${id}/away`, { method: 'POST', keepalive: true }, true);
  }

  async gameRematch(id: string): Promise<GameView> {
    return this.request<GameView>(`/games/${id}/rematch`, { method: 'POST' });
  }

  async gameBlock(id: string): Promise<void> {
    await this.request(`/games/${id}/block`, { method: 'POST' });
  }
}

export const api = new ApiService();
