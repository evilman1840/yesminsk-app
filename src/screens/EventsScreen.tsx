import React, { useState } from 'react';
import { Compass, Users, User, Calendar, MapPin, Plus, Clock, Send, Check, X, Loader2, Sparkles } from 'lucide-react';
import { AppEvent, EventCategory, EVENT_CATEGORIES_CONFIG } from '../types';
import { telegramService } from '../services/telegram';
import { api } from '../services/api';

interface EventsScreenProps {
  events: AppEvent[];
  onRefreshEvents: () => void;
  onOpenMap: () => void;
  onOpenFeed: () => void;
  onOpenProfile: () => void;
  currentArea: string;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  events,
  onRefreshEvents,
  onOpenMap,
  onOpenFeed,
  onOpenProfile,
  currentArea
}) => {
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Поля формы нового события
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

  // Переключение участия в событии
  const handleToggleJoin = async (event: AppEvent) => {
    telegramService.haptic('selection');
    setJoiningId(event.id);
    try {
      await api.toggleJoinEvent(event.id, event.isJoined);
      telegramService.haptic('success');
      onRefreshEvents();
    } catch (err: any) {
      alert(err.message || 'Ошибка обновления участия');
    } finally {
      setJoiningId(null);
    }
  };

  // Создание события
  const handleCreateEvent = async (e: React.FormEvent) => {
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

      await api.createEvent({
        title: title.trim(),
        description: description.trim(),
        category,
        locationName: locationName.trim(),
        coordinates: defaultCoords,
        dateTime: new Date(dateTime).toISOString(),
        maxParticipants: Number(maxParticipants) || 0
      });

      telegramService.haptic('success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      onRefreshEvents();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка создания события');
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
              События Минска
            </span>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-zine-inkMuted">
              сходки • встречи
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            telegramService.haptic('medium');
            setIsModalOpen(true);
          }}
          className="px-2.5 py-1 rounded-full bg-zine-terracotta hover:bg-zine-terracottaHover text-white text-[11px] font-semibold flex items-center gap-1 shadow-zine-sm active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={12} strokeWidth={2.5} />
          <span>Сходка</span>
        </button>
      </header>

      {/* Фильтр категорий встреч */}
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
          Все ({events.length})
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
              {count > 0 && (
                <span className={`text-[9.5px] ml-0.5 opacity-80 ${isActive ? 'text-white' : 'text-zine-inkMuted'}`}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Лента событий */}
      <main className="flex-1 overflow-y-auto p-3.5 space-y-3.5 pb-20">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-zine-inkMuted flex flex-col items-center justify-center h-64">
            <Calendar size={32} className="text-zine-terracotta/40 mb-2" />
            <p className="font-serif text-sm text-zine-ink font-semibold">Пока нет запланированных сходок</p>
            <p className="text-xs text-zine-inkMuted mt-1 max-w-[240px]">
              Будь первым! Нажми «+ Сходка» вверху, чтобы позвать компанию на прогулку или в кафе.
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const catConfig = EVENT_CATEGORIES_CONFIG[event.category] || EVENT_CATEGORIES_CONFIG.walk;
            const isFull = event.maxParticipants > 0 && event.participantsCount >= event.maxParticipants;

            return (
              <div
                key={event.id}
                className="p-4 rounded-2xl bg-zine-card border border-zine-border shadow-zine hover:shadow-zine-lg transition-all relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full ${catConfig.badgeBg} opacity-40 blur-2xl pointer-events-none`} />

                <div className="relative z-10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10.5px] font-bold border ${catConfig.badgeBg} ${catConfig.badgeText} border-black/5`}>
                      <span>{catConfig.emoji}</span>
                      <span>{catConfig.label}</span>
                    </span>

                    <span className="flex items-center gap-1 text-[11px] font-semibold text-zine-terracotta bg-zine-terracotta/10 px-2.5 py-0.5 rounded-full">
                      <Clock size={11} />
                      <span>{formatEventDate(event.dateTime)}</span>
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-[16px] text-zine-ink leading-snug">
                    {event.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-zine-ink font-medium">
                    <MapPin size={13} className="text-zine-terracotta shrink-0" />
                    <span className="truncate">{event.locationName}</span>
                  </div>

                  <p className="text-xs text-zine-ink/90 leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>

                  <div className="pt-2 border-t border-zine-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={event.creator.avatarUrl}
                        alt={event.creator.name}
                        className="w-6 h-6 rounded-full object-cover border border-zine-border"
                      />
                      <span className="text-[11px] text-zine-inkMuted truncate">
                        Организатор: <strong className="text-zine-ink">{event.creator.name}</strong>
                      </span>
                    </div>

                    <span className="text-[11px] font-semibold text-zine-ink shrink-0">
                      👥 {event.participantsCount}
                      {event.maxParticipants > 0 ? ` / ${event.maxParticipants}` : ''} чел
                    </span>
                  </div>

                  <div className="pt-1 flex gap-2">
                    <button
                      onClick={() => handleToggleJoin(event)}
                      disabled={joiningId === event.id || (!event.isJoined && isFull)}
                      className={`flex-1 py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer ${
                        event.isJoined
                          ? 'bg-zine-sage text-white'
                          : isFull
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-zine-terracotta hover:bg-zine-terracottaHover text-white'
                      }`}
                    >
                      {joiningId === event.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : event.isJoined ? (
                        <>
                          <Check size={13} strokeWidth={3} />
                          <span>Ты идёшь (Отменить)</span>
                        </>
                      ) : isFull ? (
                        <span>Мест нет</span>
                      ) : (
                        <>
                          <span>Присоединиться</span>
                          <span>→</span>
                        </>
                      )}
                    </button>

                    {event.creator.username && (
                      <button
                        onClick={() => {
                          telegramService.haptic('light');
                          telegramService.openChat(event.creator.username);
                        }}
                        className="py-2 px-3 rounded-xl bg-zine-cardElevated border border-zine-border hover:bg-white text-zine-ink text-xs font-medium flex items-center gap-1 cursor-pointer"
                        title="Написать организатору"
                      >
                        <Send size={12} />
                        <span className="hidden sm:inline">В TG</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Модальное окно создания события */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          <div className="w-full max-w-md bg-zine-cardElevated rounded-t-3xl sm:rounded-2xl border border-zine-border p-5 shadow-zine-float relative z-10 max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between pb-3 border-b border-zine-border">
              <h3 className="font-serif font-bold text-base text-zine-ink flex items-center gap-1.5">
                <Sparkles size={16} className="text-zine-terracotta" />
                <span>Новая сходка в Минске</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zine-card border border-zine-border flex items-center justify-center text-zine-inkMuted hover:text-zine-ink cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-3.5 py-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
                  Название сходки *
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Прогулка по Осмоловке и кофе"
                  className="w-full px-3 py-2 rounded-xl bg-zine-card border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
                  Категория *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(EVENT_CATEGORIES_CONFIG) as EventCategory[]).map((cat) => {
                    const c = EVENT_CATEGORIES_CONFIG[cat];
                    const isSel = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`py-1.5 px-1 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 transition-all ${
                          isSel
                            ? 'bg-zine-terracotta text-white border-zine-terracotta shadow-sm'
                            : 'bg-zine-card border-zine-border text-zine-ink'
                        }`}
                      >
                        <span>{c.emoji}</span>
                        <span className="truncate">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
                  Где собираемся? (точка / ориентир) *
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Вход в парк Челюскинцев / кофейня Зерно"
                  className="w-full px-3 py-2 rounded-xl bg-zine-card border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
                    Когда? *
                  </label>
                  <input
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-zine-card border border-zine-border text-xs text-zine-ink focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
                    Лимит мест (0 = без лимита)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zine-card border border-zine-border text-xs text-zinc-800 text-center focus:outline-none focus:border-zine-terracotta shadow-zine-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zine-ink uppercase tracking-wider">
                  Подробности встречи *
                </label>
                <textarea
                  rows={3}
                  maxLength={400}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Что будем делать? Какой темп прогулки? Напиши подробнее."
                  className="w-full px-3 py-2 rounded-xl bg-zine-card border border-zine-border text-xs text-zine-ink leading-relaxed focus:outline-none focus:border-zine-terracotta shadow-zine-sm resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-zine-terracotta hover:bg-zine-terracottaHover text-white font-semibold text-xs tracking-wide shadow-zine active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Публикуем сходку...</span>
                    </>
                  ) : (
                    <span>Опубликовать сходку в YesMinsk →</span>
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
