import React, { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { PlaceItem, PLACE_MOODS } from '../../types';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { forgetNotInterestedPlace } from '../../screens/PlacesScreen';

/**
 * «Скрытые места» в анкете: всё, что смахнули «Неинтересно», можно вернуть в ленту.
 * Пока скрытых нет — раздел не показываем
 */
export const HiddenPlaces: React.FC<{ onRestored: () => void }> = ({ onRestored }) => {
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    api.getHiddenPlaces().then(setPlaces).catch(() => {});
  }, []);

  if (places.length === 0) return null;

  const restore = async (place: PlaceItem) => {
    setRestoringId(place.id);
    try {
      await api.hidePlace(place.id, false);
      forgetNotInterestedPlace(place.id);
      setPlaces((prev) => prev.filter((p) => p.id !== place.id));
      telegramService.haptic('success');
      onRestored();
    } catch (err: any) {
      alert(err.message || 'Не получилось вернуть место');
    } finally {
      setRestoringId(null);
    }
  };

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
          <span className="block text-body font-bold text-zine-ink">🙈 Скрытые места · {places.length}</span>
          <span className="block text-sm2 text-zine-inkMuted">Те, что смахнули «Неинтересно». Можно вернуть</span>
        </span>
        <ChevronDown size={22} className={`text-zine-inkMuted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-3 divide-y divide-zine-border">
          {places.map((place) => (
            <div key={place.id} className="py-2.5 flex items-center gap-3">
              <span className="text-[22px] leading-none shrink-0">{PLACE_MOODS[place.moods[0]]?.emoji || '📍'}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-body font-semibold text-zine-ink truncate">{place.name}</span>
                {place.category && <span className="block text-cap text-zine-inkMuted truncate">{place.category}</span>}
              </span>
              <button
                type="button"
                onClick={() => restore(place)}
                disabled={restoringId === place.id}
                className="shrink-0 h-10 px-4 rounded-full bg-zine-card text-zine-ink text-sm2 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              >
                {restoringId === place.id ? <Loader2 size={18} className="animate-spin" /> : 'Вернуть'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
