import React, { useState } from 'react';
import { Compass, Users, User, Calendar, MapPin, Plus, Clock, Check, X, Loader2, Edit2, Trash2, Navigation, Search } from 'lucide-react';
import { AppEvent, EventCategory, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';

export const MINSK_SPOTS_PRESETS: Array<{ name: string; aliases: string[]; coords: [number, number] }> = [
  { name: 'ул. Ленина 5', aliases: ['ленина 5', 'ленина, 5', 'ул. ленина 5', 'ленина'], coords: [53.8998, 27.5585] },
  { name: 'Октябрьская 19', aliases: ['октябрьская 19', 'октябрьская', 'oktyabr'], coords: [53.8905, 27.5740] },
  { name: 'Зыбицкая 6', aliases: ['зыбицкая 6', 'зыбицкая'], coords: [53.9056, 27.5585] },
  { name: 'Немига 3', aliases: ['немига 3', 'немига', 'верхний город'], coords: [53.9045, 27.5520] },
  { name: 'Осмоловка / Киселёва', aliases: ['осмоловк', 'киселёв', 'зерно'], coords: [53.9115, 27.5612] },
  { name: 'пр-т Независимости 4', aliases: ['независимости 4', 'независимост'], coords: [53.8965, 27.5510] },
  { name: 'Galleria Minsk (Победителей 9)', aliases: ['победителей 9', 'победител', 'галерея', 'galleria'], coords: [53.9095, 27.5480] },
  { name: 'Песочница (Куйбышева 45)', aliases: ['песочниц', 'куйбышева 45', 'куйбышев'], coords: [53.9155, 27.5690] },
  { name: 'Комаровка', aliases: ['комаровк'], coords: [53.9190, 27.5800] },
  { name: 'Парк Челюскинцев', aliases: ['челюскин', 'ботаническ'], coords: [53.9240, 27.6150] },
  { name: 'Парк Горького', aliases: ['горьког'], coords: [53.9030, 27.5760] },
  { name: 'Площадь Победы', aliases: ['площадь побед', 'пл. побед'], coords: [53.9085, 27.5750] },
  { name: 'Новая Боровая', aliases: ['боров'], coords: [53.9550, 27.6750] },
  { name: 'Восток / Dana Mall', aliases: ['восток', 'библиотек', 'dana mall', 'дана молл'], coords: [53.9335, 27.6530] },
  { name: 'Уручье / Музей валунов', aliases: ['уручь', 'музей валунов', 'валун'], coords: [53.9450, 27.6880] }
];

export const resolveEventCoordinates = async (
  address: string,
  existingCoords?: [number, number]
): Promise<[number, number]> => {
  const trimmed = address.trim();
  if (!trimmed) {
    return existingCoords || [53.9045, 27.5615];
  }

  const lower = trimmed.toLowerCase();

  // 1. Полноценное геокодирование через скрипт Яндекс.Карт
  try {
    const ymaps = (window as any).ymaps;
    if (ymaps && typeof ymaps.geocode === 'function') {
      const query = lower.includes('минск') ? trimmed : `Беларусь, Минск, ${trimmed}`;
      const res = await ymaps.geocode(query, { results: 1 });
      const firstGeoObject = res.geoObjects?.get?.(0);
      if (firstGeoObject) {
        const coords = firstGeoObject.geometry?.getCoordinates();
        if (Array.isArray(coords) && coords.length === 2) {
          const c0 = Number(coords[0]);
          const c1 = Number(coords[1]);
          if (c0 > 40 && c1 < 40) return [c0, c1];
          if (c1 > 40 && c0 < 40) return [c1, c0];
        }
      }
    }
  } catch (geoErr) {
    console.warn('Yandex Geocode error:', geoErr);
  }

  // 2. Поиск по популярным местам
  for (const spot of MINSK_SPOTS_PRESETS) {
    if (spot.aliases.some((alias) => lower.includes(alias))) {
      return spot.coords;
    }
  }

  // 3. OpenStreetMap
  try {
    const nomQuery = lower.includes('минск') ? trimmed : `Беларусь, Минск, ${trimmed}`;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(nomQuery)}&limit=1`,
      { headers: { 'Accept-Language': 'ru' } }
    );
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon) && lat >= 53.7 && lat <= 54.1) {
          return [lat, lon];
        }
      }
    }
  } catch (nomErr) {
    console.warn('Nominatim error:', nomErr);
  }

  return existingCoords || [53.9045, 27.5615];
};

export interface EventsScreenProps {
  events: AppEvent[];
  currentUserId?: number;
  onCreateEvent?: (eventData: {
    title: string;
    description: string;
    category: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }) => Promise<any>;
  onUpdateEvent?: (eventId: string, eventData: {
    title: string;
    description: string;
    category: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }) => Promise<any>;
  onDeleteEvent?: (eventId: string) => Promise<any> | void;
  onToggleJoin?: (event: AppEvent) => void;
  onRefreshEvents?: () => void;
  onOpenMap?: () => void;
  onOpenFeed?: () => void;
  onOpenProfile?: () => void;
  currentArea?: string;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  events,
  currentUserId: propUserId,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onToggleJoin,
  onRefreshEvents,
  onOpenMap,
  onOpenFeed,
  onOpenProfile,
  currentArea = 'Минск'
}) => {
  const currentTgUser = telegramService.getUser();
  const currentUserId = propUserId || currentTgUser?.id;

  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('walk');
  const [locationName, setLocationName] = useState('');
  const [customCoords, setCustomCoords] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [dateTime, setDateTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredEvents = selectedCategory === 'all'
    ? events
    : events.filter((e) => e.category === selectedCategory);

  const formatEventDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('ru-RU', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const handleOpenCreateModal = () => {
    telegramService.haptic('selection');
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    setCategory('walk');
    setLocationName('');
    setCustomCoords(null);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(0, 0, 0);
    setDateTime(tomorrow.toISOString().slice(0, 16));
    setMaxParticipants('0');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev: AppEvent) => {
    telegramService.haptic('selection');
    const targetId = String(ev.id || (ev as any)._id);
    setEditingEventId(targetId);
    setTitle(ev.title || '');
    setDescription(ev.description || '');
    setCategory(ev.category || 'walk');
    setLocationName(ev.locationName || '');
    setCustomCoords(ev.coordinates || null);
    try {
      const d = new Date(ev.dateTime);
      setDateTime(d.toISOString().slice(0, 16));
    } catch {
      setDateTime('');
    }
    setMaxParticipants(String(ev.maxParticipants || 0));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleGeocodeAddress = async (addr: string) => {
    if (!addr.trim()) return;
    setIsGeocoding(true);
    try {
      const coords = await resolveEventCoordinates(addr.trim());
      setCustomCoords(coords);
      telegramService.haptic('selection');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается');
      return;
    }
    setIsLocating(true);
    telegramService.haptic('selection');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setCustomCoords([lat, lng]);
        telegramService.haptic('success');
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS error:', err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleDeleteEvent = async (ev: AppEvent) => {
    const targetId = ev.id || (ev as any)._id;
    if (!targetId) return;
    if (!window.confirm(`Удалить сходку "${ev.title}"?`)) return;

    setDeletingId(String(targetId));
    try {
      if (onDeleteEvent) {
        await onDeleteEvent(String(targetId));
      } else {
        await api.deleteEvent(String(targetId));
      }
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleJoin = async (event: AppEvent) => {
    const targetId = event.id || (event as any)._id;
    setJoiningId(String(targetId));
    try {
      if (onToggleJoin) {
        await onToggleJoin(event);
      } else {
        await api.toggleJoinEvent(String(targetId), Boolean(event.isJoined));
      }
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      alert(err.message || 'Ошибка обновления участия');
    } finally {
      setJoiningId(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !locationName.trim() || !dateTime) {
      setFormError('Заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    try {
      // Всегда определяем точные координаты по введенному адресу
      let resolvedCoords = customCoords;
      if (!resolvedCoords || resolvedCoords.length !== 2) {
        resolvedCoords = await resolveEventCoordinates(locationName.trim());
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        locationName: locationName.trim(),
        coordinates: resolvedCoords,
        dateTime: new Date(dateTime).toISOString(),
        maxParticipants: Number(maxParticipants) || 0
      };

      if (editingEventId) {
        if (onUpdateEvent) {
          await onUpdateEvent(editingEventId, payload);
        } else {
          await api.updateEvent(editingEventId, payload);
        }
      } else {
        if (onCreateEvent) {
          await onCreateEvent(payload);
        } else {
          await api.createEvent(payload);
        }
      }

      setIsModalOpen(false);
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения сходки');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-hidden relative select-none bg-zine-paper">
      
      {/* Шапка */}
      <header className="px-4 py-2.5 bg-zine-paper/95 backdrop-blur-md border-b border-zine-border/80 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-zine-terracotta text-white flex items-center justify-center font-serif font-bold text-xs shadow-zine-sm">
            Y
          </div>
          <span className="font-serif font-bold text-[16px] tracking-tight text-zine-ink">
            Сходки YesMinsk
          </span>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-3 py-1 rounded-full bg-zine-terracotta hover:bg-zine-terracottaHover text-white text-xs font-semibold flex items-center gap-1 shadow-zine-sm active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>Создать</span>
        </button>
      </header>

      {/* Фильтры категорий */}
      <div className="px-3 py-2 bg-zine-paper/90 border-b border-zine-border/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border ${
            selectedCategory === 'all'
              ? 'bg-zinc-800 text-white border-zinc-800'
              : 'bg-white text-zinc-700 border-zinc-200'
          }`}
        >
          Все ({events.length})
        </button>

        {(Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).map((cat) => {
          const cfg = EVENT_CATEGORIES_CONFIG[cat];
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all border ${
                isActive
                  ? 'bg-zinc-800 text-white border-zinc-800'
                  : 'bg-white text-zinc-700 border-zinc-200'
              }`}
            >
              <span>{cfg.emoji}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Список сходок */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 pb-20">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-zinc-300 mt-4">
            <span className="text-3xl mb-2 block">⭐️</span>
            <h4 className="font-serif font-bold text-base text-zinc-800 mb-1">Пока нет сходок в этой категории</h4>
            <p className="text-xs text-zinc-500 mb-4">Будь первым, кто соберет компанию на прогулку или в музей!</p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-zine-terracotta text-white font-semibold text-xs shadow-sm cursor-pointer"
            >
              + Создать сходку
            </button>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || { emoji: '⭐️', label: 'Сходка', badgeBg: 'bg-zinc-100', badgeText: 'text-zinc-800' };
            const isCreator = Boolean(
              currentUserId && (
                Number(ev.creator?.telegramId) === Number(currentUserId) ||
                (ev as any).creatorId === String(currentUserId)
              )
            );
            const isJoining = joiningId === String(ev.id);
            const isDeleting = deletingId === String(ev.id);

            return (
              <div
                key={ev.id}
                className="p-4 rounded-2xl bg-white border border-zine-border shadow-sm hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10.5px] font-bold ${catConfig.badgeBg} ${catConfig.badgeText}`}>
                    <span>{catConfig.emoji}</span>
                    <span>{catConfig.label}</span>
                  </span>

                  <span className="flex items-center gap-1 text-[11px] font-semibold text-zine-terracotta bg-zine-terracotta/10 px-2.5 py-0.5 rounded-full">
                    <Clock size={11} strokeWidth={2.4} />
                    <span>{formatEventDate(ev.dateTime)}</span>
                  </span>
                </div>

                <h3 className="font-serif font-bold text-[16px] text-zinc-900 leading-snug mb-1">
                  {ev.title}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2">
                  <MapPin size={13} className="shrink-0 text-zine-terracotta" />
                  <span className="truncate">{ev.locationName}</span>
                </div>

                <p className="text-xs text-zinc-700 leading-relaxed mb-3 whitespace-pre-wrap">
                  {ev.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    <img
                      src={ev.creator?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={ev.creator?.name || 'Организатор'}
                      className="w-6 h-6 rounded-full object-cover border border-zinc-200"
                    />
                    <span className="text-[10.5px] font-medium text-zinc-700">
                      {ev.creator?.name || 'Организатор'}
                      {isCreator && <span className="ml-1 text-[9px] font-bold text-zine-terracotta">(ты)</span>}
                    </span>
                  </div>

                  <span className="text-[10.5px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                    👥 {ev.participantsCount || 1} участников
                  </span>
                </div>

                {isCreator && (
                  <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2 border-t border-dashed border-zinc-200">
                    <button
                      onClick={() => handleOpenEditModal(ev)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={11} />
                      <span>Редактировать</span>
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(ev)}
                      disabled={isDeleting}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={11} />
                      <span>{isDeleting ? '...' : 'Удалить'}</span>
                    </button>
                  </div>
                )}

                <div className="mt-3">
                  <button
                    onClick={() => handleToggleJoin(ev)}
                    disabled={isJoining}
                    className={`w-full py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer ${
                      ev.isJoined
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zine-terracotta hover:bg-zine-terracottaHover text-white'
                    }`}
                  >
                    {isJoining ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : ev.isJoined ? (
                      <>
                        <Check size={13} strokeWidth={3} />
                        <span>Ты идёшь (Отменить участие)</span>
                      </>
                    ) : (
                      <span>Присоединиться к сходке</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Модальное окно создания / редактирования */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-zinc-900">
                {editingEventId ? 'Редактировать сходку' : 'Новая сходка в Минске'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-4 overflow-y-auto space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">Название сходки *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Прогулка по Осмоловке с кофе"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:border-zine-terracotta"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">Категория *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).map((cat) => {
                    const cfg = EVENT_CATEGORIES_CONFIG[cat];
                    const isSelected = category === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zine-terracotta text-white border-zine-terracotta font-bold'
                            : 'bg-white border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <div className="text-sm">{cfg.emoji}</div>
                        <div className="text-[10px] truncate mt-0.5">{cfg.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-zinc-800">Где встречаемся (Адрес или заведение) *</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleGeocodeAddress(locationName)}
                      disabled={isGeocoding}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full cursor-pointer"
                    >
                      {isGeocoding ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                      <span>Найти точку</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGetGPS}
                      disabled={isLocating}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-full cursor-pointer"
                    >
                      {isLocating ? <Loader2 size={10} className="animate-spin" /> : <Navigation size={10} />}
                      <span>Мой GPS</span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    // Сбрасываем старые координаты, чтобы адрес определился заново
                    setCustomCoords(null);
                  }}
                  onBlur={() => {
                    if (locationName.trim()) {
                      handleGeocodeAddress(locationName.trim());
                    }
                  }}
                  placeholder="Например: ул. Ленина 5 или Октябрьская 19"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:border-zine-terracotta"
                  required
                />

                {/* Индикатор найденных координат */}
                {customCoords && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Check size={11} strokeWidth={2.5} />
                    <span>Точка найдена: [{customCoords[0].toFixed(4)}, {customCoords[1].toFixed(4)}]</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mt-1">
                  <span className="text-[9.5px] text-zinc-400 shrink-0 font-medium">Быстро:</span>
                  {MINSK_SPOTS_PRESETS.slice(0, 6).map((spot) => (
                    <button
                      type="button"
                      key={spot.name}
                      onClick={() => {
                        setLocationName(spot.name);
                        setCustomCoords(spot.coords);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-700 text-[10px] whitespace-nowrap cursor-pointer hover:bg-zinc-200"
                    >
                      {spot.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">Дата и время *</label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:border-zine-terracotta"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">Описание сходки *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Опиши план встречи, кого ждешь, как одеться..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:border-zine-terracotta resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-zine-terracotta hover:bg-zine-terracottaHover text-white font-semibold text-xs shadow-md active:scale-[0.99] transition-all cursor-pointer"
              >
                {isSubmitting ? 'Сохранение...' : editingEventId ? 'Сохранить изменения' : 'Опубликовать сходку'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TabBar */}
      <nav className="h-14 bg-zine-paper/95 backdrop-blur-md border-t border-zine-border flex items-center justify-around px-2 z-30 shrink-0">
        <button
          onClick={onOpenMap}
          className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-zinc-900 cursor-pointer"
        >
          <Compass size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Карта</span>
        </button>

        <button
          onClick={onOpenFeed}
          className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-zinc-900 cursor-pointer"
        >
          <Users size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Люди</span>
        </button>

        <button className="flex flex-col items-center gap-0.5 text-zine-terracotta cursor-pointer">
          <Calendar size={18} strokeWidth={2.4} />
          <span className="text-[9px] font-bold">События ({events.length})</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-zinc-900 cursor-pointer"
        >
          <User size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Профиль</span>
        </button>
      </nav>

    </div>
  );
};

export default EventsScreen;
