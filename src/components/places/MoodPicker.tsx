import React from 'react';
import { X } from 'lucide-react';
import { PlaceMood, PLACE_MOODS } from '../../types';
import { telegramService } from '../../services/telegram';

type MoodFilter = PlaceMood | 'all';

/**
 * Чипсы настроений над картой в режиме «Места»
 */
export const MoodChips: React.FC<{ value: MoodFilter; onChange: (m: MoodFilter) => void }> = ({ value, onChange }) => (
  <>
    {([['all', 'Все места', ''], ...(Object.keys(PLACE_MOODS) as PlaceMood[]).map((m) => [m, PLACE_MOODS[m].label, PLACE_MOODS[m].emoji])] as [
      MoodFilter,
      string,
      string
    ][]).map(([id, label, emoji]) => {
      const isActive = value === id;
      return (
        <button
          key={id}
          onClick={() => {
            telegramService.haptic('selection');
            onChange(id);
          }}
          className={`h-11 px-4 shrink-0 rounded-full text-sm2 font-semibold whitespace-nowrap flex items-center gap-2 border transition-colors cursor-pointer ${
            isActive ? 'bg-zine-ink text-zine-paper border-zine-ink' : 'bg-zine-cardElevated text-zine-ink border-zine-border shadow-zine'
          }`}
        >
          {emoji && <span className="text-[18px] leading-none">{emoji}</span>}
          <span>{label}</span>
        </button>
      );
    })}
  </>
);

/**
 * «С каким настроением ты сегодня?» — как на главной блога. Показывается при первом входе в «Места»
 */
export const MoodPicker: React.FC<{ counts: Partial<Record<PlaceMood, number>>; onPick: (m: MoodFilter) => void; onClose: () => void }> = ({
  counts,
  onPick,
  onClose
}) => (
  <div className="p-4 rounded-zine bg-zine-cardElevated shadow-zine-float">
    <div className="flex items-start justify-between gap-2">
      <p className="font-serif font-bold text-title text-zine-ink">С каким настроением ты сегодня?</p>
      <button onClick={onClose} aria-label="Закрыть" className="w-10 h-10 -mt-1 -mr-1 shrink-0 rounded-full flex items-center justify-center text-zine-inkMuted cursor-pointer">
        <X size={20} />
      </button>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {(Object.keys(PLACE_MOODS) as PlaceMood[]).map((m) => (
        <button
          key={m}
          onClick={() => {
            telegramService.haptic('selection');
            onPick(m);
          }}
          className="min-h-[56px] px-3 py-2 rounded-zine-sm bg-zine-card text-left flex items-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <span className="text-[22px] leading-none">{PLACE_MOODS[m].emoji}</span>
          <span className="text-sm2 font-semibold text-zine-ink leading-tight">
            {PLACE_MOODS[m].label}
            {counts[m] ? <span className="text-zine-inkMuted font-medium"> · {counts[m]}</span> : null}
          </span>
        </button>
      ))}
      <button
        onClick={() => onPick('all')}
        className="min-h-[56px] px-3 py-2 rounded-zine-sm bg-zine-ink text-zine-paper text-sm2 font-bold cursor-pointer"
      >
        Показать все
      </button>
    </div>
  </div>
);
