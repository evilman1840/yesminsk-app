import React, { useState } from 'react';
import { Compass, Users, Calendar, MapPin, Plus, Clock, Send, Check, X, Loader2, Sparkles, Edit2, Trash2, Navigation } from 'lucide-react';
import { AppEvent, EventCategory, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';

// Пресеты популярных мест Минска
export const MINSK_SPOTS: Array<{ name: string; aliases: string[]; coords: [number, number] }> = [
  { name: 'ул. Ленина 5', aliases: ['ленина 5', 'ленина, 5'], coords: [53.8993, 27.5574] },
  { name: 'ул. Ленина', aliases: ['ленина', 'lenina'], coords: [53.8998, 27.5595] },
  { name: 'пл. Ленина', aliases: ['пл. ленина', 'площадь ленина', 'ст.м. ленина'], coords: [53.8960, 27.5480] },
  { name: 'Октябрьская 19', aliases: ['октябрьская 19', 'октябрьская'], coords: [53.8905, 27.5740] },
  { name: 'Немига / Верхний город', aliases: ['немиг', 'верхний город', 'ратуш'], coords: [53.9045, 27.5520] },
  { name: 'Зыбицкая', aliases: ['зыбицк'], coords: [53.9056, 27.5585] },
  { name: 'Осмоловка / Коммунистическая', aliases: ['осмоловк', 'зерно'], coords: [53.9115, 27.5612] },
  { name: 'Карла Маркса', aliases: ['маркса'], coords: [53.8975, 27.5570] },
  { name: 'пр-т Независимости 4', aliases: ['независимости', 'незалежнасц'], coords: [53.8965, 27.5505] },
  { name: 'Парк Челюскинцев', aliases: ['челюскин', 'ботаническ'], coords: [53.9240, 27.6150] },
  { name: 'Новая Боровая', aliases: ['боров'], coords: [53.9550, 27.6750] },
  { name: 'Комаровка', aliases: ['комаровк', 'куйбышев'], coords: [53.9190, 27.5800] }
];

/**
 * Точное определение координат по адресу в Минске
 */
export const resolveExactAddressCoordinates = async (
  address: string,
  apiKey: string = import.meta.env.VITE_YANDEX_MAPS_KEY || ''
): Promise<[number, number]> => {
  const trimmed = address.trim();
  if (!trimmed) return [53.9045, 27.5615];

  const lower = trimmed.toLowerCase();

  // 1. Прямой запрос к Яндекс.Геокодеру
  if (apiKey) {
    try {
      const query = lower.includes('минск') ? trimmed : `Минск, ${trimmed}`;
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(query)}&format=json&results=1`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const pos = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
        if (pos) {
          const [lon, lat] = pos.split(' ').map(Number);
          if (!isNaN(lat) && !isNaN(lon)) {
            return [lat, lon];
          }
        }
      }
    } catch (e) {
      console.warn('Yandex geocode error:', e);
    }
  }

  // 2. Поиск по пресетам улиц и номеров домов
  for (const spot of MINSK_SPOTS) {
    if (spot.aliases.some((alias) => lower.includes(alias))) {
      return spot.coords;
    }
  }

  return [53.9045, 27.5615];
};

export interface EventsScreenProps {
  events: AppEvent[];
  onCreateEvent?: (eventData: {
    title: string;
    description: string;
    category: string;
    locationName: string;
    coordinates: [number, number];
    dateTime: string;
    maxParticipants?: number;
  }) => Promise<AppEvent>;
  onUpdateEvent?: (eventId: string, eventData: any) => Promise<any>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onToggleJoin?: (event: AppEvent) => void;
  onOpenMap?: () => void;
  onOpenFeed?: () => void;
  onOpenProfile?: () => void;
  currentUserId?: number;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  events,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onToggleJoin,
  onOpenMap,
  onOpenFeed,
  onOpenProfile,
  currentUserId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Поля формы
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('walk');
  const [locationName, setLocationName] = useState('ул. Ленина 5');
  const [coordinates, setCoordinates] = useState<[number, number]>([53.8993, 27.5574]);
  const [dateTime, setDateTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number>(6);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenCreateModal = () => {
    telegramService.haptic('selection');
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    setCategory('walk');
    setLocationName('ул. Ленина 5');
    setCoordinates([53.8993, 27.5574]);
    setDateTime(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    setMaxParticipants(6);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev: AppEvent) => {
    telegramService.haptic('selection');
    setEditingEventId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description);
    setCategory(ev.category);
    setLocationName(ev.locationName);
    setCoordinates(ev.coordinates || [53.9045, 27.5615]);
    setDateTime(new Date(ev.dateTime).toISOString().slice(0, 16));
    setMaxParticipants(ev.maxParticipants || 6);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Геокодирование введенного адреса
  const handleAddressChange = async (newAddress: string) => {
    setLocationName(newAddress);
    if (newAddress.trim().length >= 4) {
      setIsGeocoding(true);
      const coords = await resolveExactAddressCoordinates(newAddress);
      setCoordinates(coords);
      setIsGeocoding(false);
    }
  };

  // GPS определение
  const handleGpsCurrent = () => {
    if (!navigator.geolocation) return;
    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates([pos.coords.latitude, pos.coords.longitude]);
        setLocationName('Моя GPS точка в Минске');
        setIsGeocoding(false);
        telegramService.haptic('success');
      },
      () => setIsGeocoding(false)
    );
  };

  // Отправка формы (создание или редактирование)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !locationName.trim() || !dateTime) {
      setFormError('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingEventId && onUpdateEvent) {
        await onUpdateEvent(editingEventId, {
          title: title.trim(),
          description: description.trim(),
          category,
          locationName: locationName.trim(),
          coordinates,
          dateTime: new Date(dateTime).toISOString(),
          maxParticipants: Number(maxParticipants) || 0
        });
      } else if (onCreateEvent) {
        await onCreateEvent({
          title: title.trim(),
          description: description.trim(),
          category,
          locationName: locationName.trim(),
          coordinates,
          dateTime: new Date(dateTime).toISOString(),
          maxParticipants: Number(maxParticipants) || 0
        });
      }
      setIsModalOpen(false);
      telegramService.haptic('success');
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения сходки');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Удаление сходки
  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Точно удалить эту сходку?')) return;
    try {
      if (onDeleteEvent) {
        await onDeleteEvent(eventId);
      } else {
        await api.deleteEvent(eventId);
      }
      telegramService.haptic('success');
    } catch (err: any) {
      alert(err.message || 'Не удалось удалить сходку');
    }
  };

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

  return (
    <div className="flex flex-col h-full w-full bg-zine-paper select-none overflow-hidden relative">
      {/* Шапка */}
      <header className="px-4 py-3 bg-zine-paper border-b border-zine-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-serif font-bold text-lg text-zinc-900 leading-tight">Сходки в Минске</h1>
          <p className="text-[11px] text-zinc-500 font-medium">Бесплатные совместные встречи без дейтинга</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-3 py-1.5 rounded-xl bg-zine-terracotta hover:bg-zinc-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>Создать</span>
        </button>
      </header>

      {/* Лента сходок */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-24">
        {events.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-4xl mb-3">☕️</div>
            <h3 className="font-serif font-bold text-base text-zinc-800 mb-1">Пока нет активных сходок</h3>
            <p className="text-xs text-zinc-500 mb-4">Будь первым, кто организует прогулку или встречу!</p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-zine-terracotta text-white text-xs font-semibold"
            >
              Создать первую сходку
            </button>
          </div>
        ) : (
          events.map((ev) => {
            const isCreator = currentUserId && ev.creator?.telegramId === currentUserId;
            const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || { emoji: '⭐️', label: 'Сходка' };

            return (
              <div
                key={ev.id}
                className="p-4 rounded-2xl bg-white border border-zine-border shadow-sm flex flex-col gap-2.5 relative"
              >
                {/* Верхняя строка: категория и действия создателя */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FAF4E6] text-[#B87C24] border border-[#F3E2B8]">
                    <span>{catConfig.emoji}</span>
                    <span>{catConfig.label}</span>
                  </span>

                  {isCreator && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(ev)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                        title="Редактировать"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-serif font-bold text-base text-zinc-900 leading-snug">{ev.title}</h3>

                <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">{ev.description}</p>

                {/* Время и локация */}
                <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-zinc-600 pt-1 border-t border-zinc-100">
                  <span className="flex items-center gap-1 text-zine-terracotta font-semibold">
                    <Clock size={12} strokeWidth={2.4} />
                    <span>{formatEventDate(ev.dateTime)}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate text-zinc-700 font-medium">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{ev.locationName}</span>
                  </span>
                </div>

                {/* Подвал карточки: кнопка участия и организатор */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] font-semibold text-zinc-500">
                    👥 {ev.participantsCount || 1}
                    {ev.maxParticipants ? ` / ${ev.maxParticipants}` : ''} участников
                  </span>

                  <div className="flex items-center gap-2">
                    {onToggleJoin && (
                      <button
                        onClick={() => onToggleJoin(ev)}
                        className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          ev.isJoined
                            ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                            : 'bg-zine-terracotta hover:bg-zinc-800 text-white shadow-sm'
                        }`}
                      >
                        {ev.isJoined ? (
                          <>
                            <Check size={12} strokeWidth={3} />
                            <span>Вы идёте</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            <span>Я пойду</span>
                          </>
                        )}
                      </button>
                    )}

                    {ev.creator?.username && (
                      <button
                        onClick={() => telegramService.openChat(ev.creator.username)}
                        className="p-1.5 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
                        title="Написать организатору"
                      >
                        <Send size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Модальное окно создания / редактирования */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-[420px] max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl p-5 overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <h2 className="font-serif font-bold text-base text-zinc-900">
                {editingEventId ? 'Редактировать сходку' : 'Новая сходка в Минске'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs mb-3 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 mb-1">Название сходки</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Прогулка по Осмоловке с кофе"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-zinc-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 mb-1">Категория</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-zinc-800"
                >
                  <option value="walk">🚶 Прогулка на воздухе</option>
                  <option value="bar">☕️ Кафе / Бар</option>
                  <option value="culture">🎬 Выставка / Кино</option>
                  <option value="trip">🌲 Поездка за город</option>
                  <option value="boardgames">🎲 Настольные игры</option>
                  <option value="sport">⚽️ Спорт / Активность</option>
                </select>
              </div>

              {/* Адрес с точным геокодингом */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-zinc-700">Точный адрес встречи</label>
                  <button
                    type="button"
                    onClick={handleGpsCurrent}
                    className="text-[10px] text-zine-terracotta font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Navigation size={10} />
                    <span>Мой GPS</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="Например: ул. Ленина 5 или Октябрьская 19"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-zinc-800"
                  required
                />

                {/* Пресеты адресов */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 mt-1">
                  {MINSK_SPOTS.slice(0, 5).map((sp) => (
                    <button
                      key={sp.name}
                      type="button"
                      onClick={() => {
                        setLocationName(sp.name);
                        setCoordinates(sp.coords);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-[10px] text-zinc-600 whitespace-nowrap"
                    >
                      {sp.name}
                    </button>
                  ))}
                </div>

                {/* Индикатор координат */}
                <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                  {isGeocoding ? (
                    <>
                      <Loader2 size={10} className="animate-spin text-zine-terracotta" />
                      <span>Ищем координаты дома...</span>
                    </>
                  ) : (
                    <span>📍 Координаты точки: [{coordinates[0].toFixed(4)}, {coordinates[1].toFixed(4)}]</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 mb-1">Дата и время</label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-zinc-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 mb-1">Описание сходки</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Что планируем делать, как найти компанию, примерная длительность..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-zinc-800 resize-none"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-zine-terracotta hover:bg-zinc-800 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <span>{editingEventId ? 'Сохранить изменения' : 'Опубликовать сходку'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Нижний TabBar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-6 py-2 flex items-center justify-around z-30">
        <button onClick={onOpenMap} className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-zinc-700">
          <Compass size={18} />
          <span className="text-[9px] font-medium">Карта</span>
        </button>
        <button onClick={onOpenFeed} className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-zinc-700">
          <Users size={18} />
          <span className="text-[9px] font-medium">Люди</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-zine-terracotta font-bold">
          <Calendar size={18} />
          <span className="text-[9px]">Сходки</span>
        </button>
        <button onClick={onOpenProfile} className="flex flex-col items-center gap-0.5 text-zinc-400 hover:text-zinc-700">
          <span className="text-base leading-none">👤</span>
          <span className="text-[9px] font-medium">Профиль</span>
        </button>
      </nav>
    </div>
  );
};

export default EventsScreen;
