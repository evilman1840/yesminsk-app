import React from 'react';
import { GOALS_CONFIG, ActivityGoal, GoalFilter, EMPATH } from '../../types';
import { telegramService } from '../../services/telegram';

/**
 * Крупные кнопки-фильтры по цели встречи. Лента прокручивается вбок
 */
export const GoalChips: React.FC<{
  value: GoalFilter;
  onChange: (goal: GoalFilter) => void;
  floating?: boolean; // поверх карты — с тенью и плотным фоном
  wrapperClassName?: string;
}> = ({ value, onChange, floating = false, wrapperClassName = 'flex gap-2 overflow-x-auto no-scrollbar px-4' }) => {
  const items: { id: GoalFilter; label: string; emoji?: string }[] = [
    { id: 'all', label: 'Все' },
    ...(Object.keys(GOALS_CONFIG) as ActivityGoal[]).filter((id) => id !== 'other').map((id) => ({
      id,
      label: GOALS_CONFIG[id].label,
      emoji: GOALS_CONFIG[id].emoji
    })),
    { id: 'guides', label: 'Покажут город', emoji: '🧭' },
    { id: 'empaths', label: 'Эмпаты', emoji: EMPATH.emoji }
  ];

  return (
    <div className={wrapperClassName}>
      {items.map((item) => {
        const isActive = value === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              telegramService.haptic('selection');
              onChange(item.id);
            }}
            className={`h-11 px-4 shrink-0 rounded-full text-sm2 font-semibold whitespace-nowrap flex items-center gap-2 border transition-colors cursor-pointer ${
              isActive
                ? 'bg-zine-ink text-zine-paper border-zine-ink'
                : `bg-zine-cardElevated text-zine-ink border-zine-border ${floating ? 'shadow-zine' : ''}`
            }`}
          >
            {item.emoji && <span className="text-[18px] leading-none">{item.emoji}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
