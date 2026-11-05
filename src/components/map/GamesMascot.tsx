import React, { useState } from 'react';
import { telegramService } from '../../services/telegram';

// После первой партии или «×» человечки уменьшаются до тихого значка ✕○
export const MASCOT_KEY = 'yesminsk_games_mascot';
const readSmall = () => {
  try {
    return localStorage.getItem(MASCOT_KEY) === 'small';
  } catch {
    return false;
  }
};
export const shrinkGamesMascot = () => {
  try {
    localStorage.setItem(MASCOT_KEY, 'small');
  } catch {
    /* приватный режим — ничего страшного */
  }
};

const Cross: React.FC = () => (
  <svg width="46" height="61" viewBox="0 0 44 58" aria-hidden className="game-hop block">
    <path d="M32 22 L40 4" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
    <path d="M10 6 L34 34 M34 6 L10 34" stroke="rgb(var(--c-terracotta))" strokeWidth="8" strokeLinecap="round" />
    <circle cx="18" cy="16" r="2.6" fill="rgb(var(--c-paper))" />
    <circle cx="26" cy="16" r="2.6" fill="rgb(var(--c-paper))" />
    <path d="M16 42 L13 55 M28 42 L31 55" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Nought: React.FC = () => (
  <svg width="46" height="61" viewBox="0 0 44 58" aria-hidden className="game-hop game-hop-late block">
    <path d="M10 22 L4 4" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
    <circle cx="22" cy="20" r="14" stroke="rgb(var(--c-mustard))" strokeWidth="7" fill="rgb(var(--c-paper) / 0.6)" />
    <circle cx="18" cy="18" r="2.6" fill="rgb(var(--c-ink))" />
    <circle cx="26" cy="18" r="2.6" fill="rgb(var(--c-ink))" />
    <path d="M18 24 Q22 28 26 24" stroke="rgb(var(--c-ink))" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M16 38 L13 55 M28 38 L31 55" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/**
 * Вход в игры с карты: крестик и нолик с табличкой «Сыграем?» в левом нижнем углу.
 * Справа на карте уже донат и ⚡, поэтому слева
 */
export const GamesMascot: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [small, setSmall] = useState(readSmall);
  const open = () => {
    telegramService.haptic('light');
    onOpen();
  };

  if (small) {
    return (
      <button
        onClick={open}
        aria-label="Сыграть в Крестики-Нолики"
        className="absolute left-4 bottom-[52px] z-20 w-14 h-14 rounded-full bg-zine-cardElevated border border-zine-border shadow-zine-float dark:bg-[#433C36] dark:border-white/25 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
      >
        <svg width="32" height="18" viewBox="0 0 30 16" aria-hidden>
          <path d="M2 2 L12 14 M12 2 L2 14" stroke="rgb(var(--c-terracotta))" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="22" cy="8" r="5.5" stroke="rgb(var(--c-mustard))" strokeWidth="3.5" fill="none" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute left-3 bottom-[44px] z-20">
      <button onClick={open} aria-label="Сыграть в Крестики-Нолики" className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform">
        <span className="px-3 py-1 rounded-zine-sm bg-zine-paper text-zine-ink text-sm2 font-bold border-2 border-zine-ink shadow-zine-sm whitespace-nowrap">Сыграем?</span>
        <span className="mt-0.5 flex items-end gap-1">
          <Cross />
          <Nought />
        </span>
      </button>
      <button
        onClick={() => {
          telegramService.haptic('selection');
          shrinkGamesMascot();
          setSmall(true);
        }}
        aria-label="Убрать человечков"
        className="absolute -top-2.5 -right-3 w-6 h-6 rounded-full bg-zine-cardElevated border border-zine-border text-zine-inkMuted text-[13px] leading-none flex items-center justify-center cursor-pointer before:absolute before:-inset-2.5 before:content-['']"
      >
        ×
      </button>
    </div>
  );
};
