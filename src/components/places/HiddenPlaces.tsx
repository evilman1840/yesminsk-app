import React, { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { AppEvent, PlaceItem, PLACE_MOODS, eventCategoryOf } from '../../types';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { forgetNotInterestedPlace } from '../../screens/PlacesScreen';
import { forgetNotInterestedEvent } from '../../screens/EventsScreen';
import { formatEventDate } from '../../screens/MapScreen';

/**
 * «Скрытое» в анкете: места и сходки, которые смахнули «Неинтересно», — можно вернуть в ленту.
 * Пока скрытого нет — раздел не показываем
 */
export const HiddenPlaces: React.FC<{ onRestored: () => void; onEventsRestored?: () => void }> = ({ onRestored, onEventsRestored }) => {
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    api.getHiddenPlaces().then(setPlaces).catch(() => {});
    api.getHiddenEvents().then(setEvents).catch(() => {});
  }, []);

  const total = places.length + events.length;
  if (total === 0) return null;

  const restore = async (kind: 'place' | 'event', id: string) => {
    setRestoringId(id);
    try {
      if (kind === 'place') {
        await api.hidePlace(id, false);
        forgetNotInterestedPlace(id);
        setPlaces((prev) => prev.filter((p) => p.id !== id));
        onRestored();
      } else {
        await api.hideEvent(id, false);
        forgetNotInterestedEvent(id);
        setEvents((prev) => prev.filter((e) => String(e.id) !== id));
        onEventsRestored?.();
      }
      telegramService.haptic('success');
    } catch (err: any) {
      telegramService.alert(err.message || 'Не получилось вернуть');
    } finally {
      setRestoringId(null);
    }
  };

  const Row: React.FC<{ id: string; kind: 'place' | 'event'; emoji: string; title: string; hint?: string }> = ({ id, kind, emoji, title, hint }) => (
    <div className="py-2.5 flex items-center gap-3">
      <span className="text-[22px] leading-none shrink-0">{emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-body font-semibold text-zine-ink truncate">{title}</span>
        {hint && <span className="block text-cap text-zine-inkMuted truncate">{hint}</span>}
      </span>
      <button
        type="button"
        onClick={() => restore(kind, id)}
        disabled={restoringId === id}
        className="shrink-0 h-10 px-4 rounded-full bg-zine-card text-zine-ink text-sm2 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
      >
        {restoringId === id ? <Loader2 size={18} className="animate-spin" /> : 'Вернуть'}
      </button>
    </div>
  );

  return (
    <section className="p-4 rounded-zine bg-zine-cardElevated border border-zine-border">
      <button
        type="button"
        onClick={() => {
          telegramService.haptic('selection');
          setIsOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between text-left cursor-pointer"
      >
        <span>
          <span className="block text-body font-bold text-zine-ink">🙈 Скрытое · {total}</span>
          <span className="block text-sm2 text-zine-inkMuted">Места и сходки, что смахнули «Неинтересно»</span>
        </span>
        <ChevronDown size={22} className={`text-zine-inkMuted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-2">
          {places.length > 0 && (
            <>
              <p className="mt-2 text-cap font-bold uppercase tracking-wider text-zine-inkMuted">Места</p>
              <div className="divide-y divide-zine-border">
                {places.map((p) => (
                  <Row key={p.id} id={p.id} kind="place" emoji={PLACE_MOODS[p.moods[0]]?.emoji || '📍'} title={p.name} hint={p.category} />
                ))}
              </div>
            </>
          )}
          {events.length > 0 && (
            <>
              <p className="mt-3 text-cap font-bold uppercase tracking-wider text-zine-inkMuted">Сходки</p>
              <div className="divide-y divide-zine-border">
                {events.map((e) => (
                  <Row key={e.id} id={String(e.id)} kind="event" emoji={eventCategoryOf(e).emoji} title={e.title} hint={formatEventDate(e.dateTime)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
