import React from 'react';
import { telegramService } from '../../services/telegram';

/**
 * Крупный чип выбора в шторке фильтров («Сходки», «Места»)
 */
export const FilterChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={() => {
      telegramService.haptic('selection');
      onClick();
    }}
    className={`h-11 px-4 rounded-full text-sm2 font-semibold border flex items-center gap-2 transition-colors cursor-pointer ${
      active ? 'bg-zine-ink text-zine-paper border-zine-ink' : 'bg-zine-cardElevated text-zine-ink border-zine-border'
    }`}
  >
    {children}
  </button>
);
