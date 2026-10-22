import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { PlaceItem, PLACE_TYPES, placeTypeEmoji } from '../../types';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';

/**
 * Фильтр по типу места: кнопка «Все типы ▾» → шторка с типами (только те, что есть, с количеством).
 * Выбран тип — кнопка показывает его с крестиком. В Местах и на карте
 */
export const PlaceTypeFilter: React.FC<{
  places: PlaceItem[];
  value: string | null;
  onChange: (type: string | null) => void;
  variant?: 'dark' | 'light'; // dark — поверх фото в Местах, light — поверх карты
}> = ({ places, value, onChange, variant = 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const counts = Object.keys(PLACE_TYPES)
    .map((t) => [t, places.filter((p) => p.category === t).length] as const)
    .filter(([, n]) => n > 0);
  if (counts.length === 0) return null;

  const idle =
    variant === 'dark'
      ? 'bg-black/35 backdrop-blur border border-white/20 text-white'
      : 'bg-zine-cardElevated border border-zine-border text-zine-ink shadow-zine';

  return (
    <>
      {value ? (
        <button
          onClick={() => {
            telegramService.haptic('selection');
            onChange(null);
          }}
          className="h-10 shrink-0 pl-3.5 pr-2.5 rounded-full bg-zine-ink text-zine-paper text-sm2 font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          {placeTypeEmoji(value)} {value}
          <X size={16} />
        </button>
      ) : (
        <button
          onClick={() => {
            telegramService.haptic('selection');
            setIsOpen(true);
          }}
          className={`h-10 shrink-0 pl-3.5 pr-2.5 rounded-full text-sm2 font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer ${idle}`}
        >
          Все типы
          <ChevronDown size={16} />
        </button>
      )}

      {isOpen && (
        <BottomSheet title="Какие места показать?" onClose={() => setIsOpen(false)}>
          <div className="grid grid-cols-2 gap-2">
            {counts.map(([t, n]) => (
              <button
                key={t}
                onClick={() => {
                  telegramService.haptic('selection');
                  onChange(t);
                  setIsOpen(false);
                }}
                className="min-h-[56px] px-3 rounded-zine-sm bg-zine-card text-left flex items-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <span className="text-[22px] leading-none">{placeTypeEmoji(t)}</span>
                <span className="text-sm2 font-semibold text-zine-ink leading-tight">
                  {t} <span className="text-zine-inkMuted font-medium">· {n}</span>
                </span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
};
