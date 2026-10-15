import React, { useState } from 'react';
import { Compass, Users, User, Calendar, MapPin, Plus, Clock, Send, Check, X, Loader2, Sparkles, Edit2, Trash2 } from 'lucide-react';
import { AppEvent, EventCategory, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';

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
  }) => Promise<any>;
  onToggleJoin?: (event: AppEvent) => void;
  onRefreshEvents?: () => void;
  onOpenMap: () => void;
  onOpenFeed?: () => void;
  onOpenProfile: () => void;
  currentArea?: string;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  events,
  onCreateEvent,
  onToggleJoin,
  onRefreshEvents,
  onOpenMap,
  onOpenFeed,
  onOpenProfile,
  currentArea = 'Минск'
}) => {
  const currentTgUser = telegramService.getUser();
  const currentUserId = currentTgUser?.id;

  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Поля формы события
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('walk');
  const [locationName, setLocationName] = useState('Октябрьская улица');
  const [dateTime, setDateTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('8');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredEvents = selectedCategory === 'all'
    ? events
    : events.filter((e) => e.category === selectedCategory);

  // Открыть модалку для создания нового события
  const handleOpenCreateModal = () => {
    telegramService.haptic('light');
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    setCategory('walk');
    setLocationName('Октябрьская улица');
    setDateTime('');
    setMaxParticipants('8');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Открыть модалку для редактирования существующего события
  const handleOpenEditModal = (ev: AppEvent) => {
    telegramService.haptic('light');
    setEditingEventId(ev.id);
    setTitle(ev.title || '');
    setDescription(ev.description || '');
    setCategory(ev.category || 'walk');
    setLocationName(ev.locationName || '');

    // Преобразуем дату в формат datetime-local YYYY-MM-DDTHH:mm
    try {
      const d = new Date(ev.dateTime);
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setDateTime(localIso);
    } catch {
      setDateTime('');
    }

    setMaxParticipants(ev.maxParticipants ? String(ev.maxParticipants) : '0');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Удаление события создателем
  const handleDeleteEvent = async (ev: AppEvent) => {
    telegramService.haptic('warning');
    const confirmed = window.confirm(`Удалить сходку "${ev.title}"?`);
    if (!confirmed) return;

    setDeletingId(ev.id);
    try {
      if ((api as any).deleteEvent) {
        await (api as any).deleteEvent(ev.id);
      } else {
        await (api as any).request(`/events/${ev.id}`, { method: 'DELETE' });
      }
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления события');
    } finally {
      setDeletingId(null);
    }
  };

  // Переключение участия в событии
  const handleToggleJoin = async (event: AppEvent) => {
    telegramService.haptic('selection');
    setJoiningId(event.id);
    try {
      if (onToggleJoin) {
        await onToggleJoin(event);
      } else {
        await api.toggleJoinEvent(event.id, Boolean(event.isJoined));
      }
      telegramService.haptic('success');
      onRefreshEvents?.();
    } catch (err: any) {
      alert(err.message || 'Ошибка обновления участия');
    } finally {
      setJoiningId(null);
    }
  };

  // Отправка формы (Создание или Редактирование)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim() || !description.trim() || !locationName.trim() || !dateTime) {
      setFormError('Заполните все обязательные поля');
      telegramService.haptic('warning');
      return;
    }

    telegramService.haptic('medium');
    setIsSubmitting(true);

    try {
      const defaultCoords: [number, number] = [53.9045, 27.5615];
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        locationName: locationName.trim(),
        coordinates: defaultCoords,
        dateTime: new Date(dateTime).toISOString(),
        maxParticipants: Number(maxParticipants) || 0
      };

      if (editingEventId) {
        // PUT-запрос на обновление
        if ((api as any).updateEvent) {
          await (api as any).updateEvent(editingEventId, payload);
        } else {
          await (api as any).request(`/events/${editingEventId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        }
      } else {
        // Создание нового события
        if (onCreateEvent) {
          await onCreateEvent(payload);
        } else {
          await api.createEvent(payload);
        }
      }

      telegramService.haptic('success');
      setIsModalOpen(false);
      setEditingEventId(null);
      setTitle('');
      setDescription('');
      onRefreshEvents?.();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения события');
    } finally {
      setIsSubmitting(false);
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
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-hidden select-none bg-zine-paper">
      
      {/* Шапка */}
      <header className="px-4 py-2.5 bg-zine-paper/95 backdrop-blur-md border-b border-zine-border/80 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-zine-terracotta text-white flex items-center justify-center font-serif font-bold text-xs shadow-zine-sm">
            Y
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-bold text-[16px] tracking-tight text-zine-ink">
              YesMinsk
            </span>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zine-inkMuted">
              Сходки
            </span>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-zine-terracotta hover:bg-zine-terracottaHover text-white text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Сходка</span>
        </button>
      </header>

      {/* Фильтр категорий сходок */}
      <div className="px-3 py-2 bg-zine-paper/90 border-b border-zine-border flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => {
            telegramService.haptic('selection');
            setSelectedCategory('all');
          }}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shadow-zine-sm border ${
            selectedCategory === 'all'
              ? 'bg-zine-terracotta text-white border-zine-terracotta'
              : 'bg-zine-cardElevated text-zine-ink border-zine-border'
          }`}
        >
          Все сходки ({events.length})
        </button>

        {(Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).map((key) => {
          const item = EVENT_CATEGORIES_CONFIG[key];
          const isActive = selectedCategory === key;
          const count = events.filter((e) => e.category === key).length;

          return (
            <button
              key={key}
              onClick={() => {
                telegramService.haptic('selection');
                setSelectedCategory(key);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all shadow-zine-sm border ${
                isActive
                  ? 'bg-zine-terracotta text-white border-zine-terracotta'
                  : 'bg-zine-cardElevated text-zine-ink border-zine-border'
              }`}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
              <span className={`text-[9.5px] ml-0.5 opacity-80 ${isActive ? 'text-white' : 'text-zine-inkMuted'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Лента событий в стиле Афиши */}
      <main className="flex-1 overflow-y-auto p-3.5 space-y-3 pb-20">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-zine-inkMuted">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3 text-xl">
              ⭐️
            </div>
            <p className="font-serif text-sm font-bold text-zine-ink">В этой категории пока нет сходок</p>
            <p className="text-xs mt-1 mb-4">Будь первым, кто соберет компанию для прогулки или чашки кофе!</p>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zine-terracotta text-white font-medium text-xs shadow-zine cursor-pointer"
            >
              <Plus size={14} />
              <span>Создать первую сходку</span>
            </button>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || {
              label: 'Сходка',
              emoji: '⭐️',
              badgeBg: 'bg-stone-100',
              badgeText: 'text-stone-800'
            };
            const isJoining = joiningId === ev.id;
            const isDeleting = deletingId === ev.id;

            // Проверка, является ли текущий пользователь автором события
            const isCreator = Boolean(
              currentUserId && (
                ev.creator?.telegramId === currentUserId ||
                (ev as any).creatorId === currentUserId ||
                (ev as any).creatorId === String(currentUserId)
              )
            );

            return (
              <div
                key={ev.id}
                className="p-4 rounded-2xl bg-zine-card border border-zine-border shadow-zine hover:shadow-zine-lg transition-all relative overflow-hidden"
              >
                {/* Фоновый легкий блик */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full ${catConfig.badgeBg} opacity-50 blur-2xl pointer-events-none`} />

                <div className="relative z-10">
                  {/* Верхняя строка афиши: категория и дата */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10.5px] font-bold border border-black/5 ${catConfig.badgeBg} ${catConfig.badgeText}`}>
                      <span>{catConfig.emoji}</span>
                      <span>{catConfig.label}</span>
                    </span>

                    <span className="flex items-center gap-1 text-[11px] font-semibold text-zine-terracotta bg-zine-terracotta/10 px-2.5 py-0.5 rounded-full">
                      <Clock size={11} strokeWidth={2.4} />
                      <span>{formatEventDate(ev.dateTime)}</span>
                    </span>
                  </div>

                  {/* Заголовок */}
                  <h3 className="font-serif font-bold text-[16px] text-zine-ink leading-snug mb-1.5">
                    {ev.title}
                  </h3>

                  {/* Местоположение */}
                  <div className="flex items-center gap-1.5 text-xs text-zine-inkMuted mb-2.5">
                    <MapPin size={13} className="text-zinc-500 shrink-0" />
                    <span className="truncate">{ev.locationName}</span>
                  </div>

                  {/* Описание */}
                  <p className="text-xs text-zine-ink/90 leading-relaxed mb-3 whitespace-pre-wrap">
                    {ev.description}
                  </p>

                  {/* Организатор и участники */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-zine-border/60">
                    <div className="flex items-center gap-2">
                      <img
                        src={ev.creator?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                        alt={ev.creator?.name || 'Организатор'}
                        className="w-6 h-6 rounded-full object-cover border border-zine-border"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10.5px] font-medium text-zine-ink leading-tight">
                          {ev.creator?.name || 'Создатель'}
                          {isCreator && <span className="ml-1 text-[9px] font-bold text-zine-terracotta">(ты)</span>}
                        </span>
                        <span className="text-[9px] text-zine-inkMuted leading-tight">
                          {ev.creator?.username ? `@${ev.creator.username}` : 'организатор'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10.5px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                      👥 {ev.participantsCount || 1}
                      {ev.maxParticipants > 0 ? ` / ${ev.maxParticipants}` : ''} участников
                    </span>
                  </div>

                  {/* Кнопки управления (только для автора) */}
                  {isCreator && (
                    <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2 border-t border-dashed border-zine-border/80">
                      <span className="text-[10px] text-zinc-400 mr-auto font-medium">Твоя сходка:</span>
                      <button
                        onClick={() => handleOpenEditModal(ev)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <Edit2 size={11} />
                        <span>Редактировать</span>
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev)}
                        disabled={isDeleting}
                        className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <Trash2 size={11} />
                        <span>{isDeleting ? '...' : 'Удалить'}</span>
                      </button>
                    </div>
                  )}

                  {/* Кнопка записи / отмены */}
                  <div className="flex items-center gap-2 mt-3 pt-2">
                    <button
                      onClick={() => handleToggleJoin(ev)}
                      disabled={isJoining}
                      className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer ${
                        ev.isJoined
                          ? 'bg-zine-sage hover:bg-emerald-700 text-white'
                          : 'bg-zine-terracotta hover:bg-zine-terracottaHover text-white'
                      }`}
                    >
                      {isJoining ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Обновляем...</span>
                        </>
                      ) : ev.isJoined ? (
                        <>
                          <Check size={14} strokeWidth={3} />
                          <span>Ты идёшь (Отменить)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          <span>Присоединиться к сходке</span>
                        </>
                      )}
                    </button>

                    {ev.creator?.username && (
                      <button
                        onClick={() => {
                          telegramService.haptic('medium');
                          telegramService.openChat(ev.creator.username);
                        }}
                        className="p-2 rounded-xl bg-zine-card border border-zine-border text-zinc-700 hover:text-zinc-900 active:scale-95 transition-all cursor-pointer"
                        title="Написать организатору в Telegram"
                      >
                        <Send size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Модальное окно создания / редактирования сходки */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zine-paper rounded-t-[28px] sm:rounded-3xl border border-zine-border p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zine-border mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{editingEventId ? '✏️' : '⭐️'}</span>
                <h3 className="font-serif font-bold text-base text-zine-ink">
                  {editingEventId ? 'Редактировать сходку' : 'Новая сходка в Минске'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingEventId(null);
                }}
                className="w-7 h-7 rounded-full bg-zine-card border border-zine-border flex items-center justify-center text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 mb-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zine-ink mb-1">
                  Название сходки *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Прогулка по Осмоловке с кофе"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-zine-border text-zine-ink focus:outline-none focus:border-zine-terracotta"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zine-ink mb-1">
                  Категория
                </label>
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
                <label className="block font-semibold text-zine-ink mb-1">
                  Где встречаемся (Адрес / Ориентир) *
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Например: ул. Коммунистическая 14, у кофейни"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-zine-border text-zine-ink focus:outline-none focus:border-zine-terracotta"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-zine-ink mb-1">
                    Дата и время *
                  </label>
                  <input
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-white border border-zine-border text-zine-ink focus:outline-none focus:border-zine-terracotta text-[11px]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zine-ink mb-1">
                    Лимит участников
                  </label>
                  <input
                    type="number"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    min="2"
                    max="50"
                    placeholder="8 (0 = без лимита)"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zine-border text-zine-ink focus:outline-none focus:border-zine-terracotta"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zine-ink mb-1">
                  Подробное описание встречи *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Расскажи, чем займемся, какой маршрут и кого ждешь..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-zine-border text-zine-ink focus:outline-none focus:border-zine-terracotta"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-zine-terracotta hover:bg-zine-terracottaHover text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-zine active:scale-98 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Сохраняем сходку...</span>
                    </>
                  ) : (
                    <span>{editingEventId ? 'Сохранить изменения →' : 'Опубликовать сходку в YesMinsk →'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Нижний 4-кнопочный TabBar */}
      <nav className="h-14 bg-zine-paper/95 backdrop-blur-md border-t border-zine-border flex items-center justify-around px-2 z-20 shrink-0">
        <button
          onClick={onOpenMap}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <Compass size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Карта</span>
        </button>

        <button
          onClick={onOpenFeed}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <Users size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Люди</span>
        </button>

        <button
          className="flex flex-col items-center gap-0.5 text-zine-terracotta cursor-pointer"
        >
          <Calendar size={18} strokeWidth={2.4} />
          <span className="text-[9px] font-bold">События ({events.length})</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center gap-0.5 text-zine-inkMuted hover:text-zine-ink cursor-pointer"
        >
          <User size={18} strokeWidth={1.8} />
          <span className="text-[9px] font-medium">Профиль</span>
        </button>
      </nav>

    </div>
  );
};

export default EventsScreen;
