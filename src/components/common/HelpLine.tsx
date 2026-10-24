import React from 'react';
import { HELP_PHONE, HELP_URL } from '../../types';
import { telegramService } from '../../services/telegram';

/**
 * Куда обращаться, если совсем тяжело: телефон 133 и экстренная психологическая помощь
 */
export const HelpLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <p className={`text-sm2 text-zine-ink ${className}`}>
    Если совсем тяжело, позвони{' '}
    <button onClick={() => telegramService.openLink(`tel:${HELP_PHONE}`)} className="font-bold text-zine-terracotta underline underline-offset-2 cursor-pointer">
      {HELP_PHONE}
    </button>{' '}
    (круглосуточно и анонимно) или загляни в{' '}
    <button onClick={() => telegramService.openLink(HELP_URL)} className="font-bold text-zine-terracotta underline underline-offset-2 cursor-pointer">
      экстренную психологическую помощь
    </button>
    : там телефоны специалистов для взрослых и детей.
  </p>
);
