import React, { useState } from 'react';
import { telegramService } from '../../services/telegram';

// «×» или сыгранная партия уменьшают человечков (или трактор) до значка — только до конца этого захода в приложение.
// В следующий раз они снова стоят с табличкой и новой фразой
export const MASCOT_KEY = 'yesminsk_games_mascot';
const PHRASE_KEY = 'yesminsk_games_mascot_phrase';
const KIND_KEY = 'yesminsk_games_mascot_kind';
const PHRASES = ['Сыграем?', 'Партейку?', 'Кто кого?', 'Пять в ряд?', 'Скучно? Сыграем!', 'Сыграешь с нами?', 'Минутка на партию?'];
const TRACTOR_PHRASES = ['Прокатимся?', 'Тр-тр, поехали?', 'Кто кого подрежет?', 'Оставим борозду?', 'Обгонишь меня?', 'Час пик в Минске!'];

type Kind = 'five' | 'tractor';

// Кто встречает на карте — человечки или трактор: строго по очереди, каждый новый запуск приложения — другой.
// Решаем один раз на запуск (а не через sessionStorage: в Telegram он иногда переживает закрытие мини-аппа)
let launchKind: Kind | null = null;
const sessionKind = (): Kind => {
  if (launchKind) return launchKind;
  try {
    const last = localStorage.getItem(KIND_KEY);
    launchKind = last === 'five' ? 'tractor' : 'five';
    if (last === null) launchKind = 'tractor'; // впервые после обновления — сразу показать трактор
    localStorage.setItem(KIND_KEY, launchKind);
  } catch {
    launchKind = Math.random() < 0.5 ? 'five' : 'tractor';
  }
  return launchKind;
};

const readSmall = () => {
  try {
    return sessionStorage.getItem(MASCOT_KEY) === 'small';
  } catch {
    return false;
  }
};
export const shrinkGamesMascot = () => {
  try {
    sessionStorage.setItem(MASCOT_KEY, 'small');
  } catch {
    /* приватный режим — ничего страшного */
  }
};

// Фраза на запуск: по кругу, чтобы подряд не повторялась; внутри запуска не меняется
let launchPhrase: number | null = null;
const sessionPhrase = (list: string[]) => {
  if (launchPhrase === null) {
    try {
      launchPhrase = (Number(localStorage.getItem(PHRASE_KEY) ?? -1) + 1) % 1000;
      localStorage.setItem(PHRASE_KEY, String(launchPhrase));
      localStorage.removeItem(MASCOT_KEY); // раньше «маленькие» запоминались навсегда
    } catch {
      launchPhrase = Math.floor(Math.random() * 1000);
    }
  }
  return list[launchPhrase % list.length];
};

export const Cross: React.FC<{ size?: number; className?: string }> = ({ size = 46, className = 'game-hop' }) => (
  <svg width={size} height={Math.round(size * 1.32)} viewBox="0 0 44 58" aria-hidden className={`${className} block`}>
    <path d="M32 22 L40 4" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
    <path d="M10 6 L34 34 M34 6 L10 34" stroke="rgb(var(--c-terracotta))" strokeWidth="8" strokeLinecap="round" />
    <circle cx="18" cy="16" r="2.6" fill="rgb(var(--c-paper))" />
    <circle cx="26" cy="16" r="2.6" fill="rgb(var(--c-paper))" />
    <path d="M16 42 L13 55 M28 42 L31 55" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Nought: React.FC<{ size?: number; className?: string }> = ({ size = 46, className = 'game-hop game-hop-late' }) => (
  <svg width={size} height={Math.round(size * 1.32)} viewBox="0 0 44 58" aria-hidden className={`${className} block`}>
    <path d="M10 22 L4 4" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
    <circle cx="22" cy="20" r="14" stroke="rgb(var(--c-mustard))" strokeWidth="7" fill="rgb(var(--c-paper) / 0.6)" />
    <circle cx="18" cy="18" r="2.6" fill="rgb(var(--c-ink))" />
    <circle cx="26" cy="18" r="2.6" fill="rgb(var(--c-ink))" />
    <path d="M18 24 Q22 28 26 24" stroke="rgb(var(--c-ink))" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M16 38 L13 55 M28 38 L31 55" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Трактор с глазами в кабине: колёса крутятся, из трубы идёт дымок, позади — борозда */
export const TractorBuddy: React.FC<{ size?: number; still?: boolean }> = ({ size = 96, still }) => (
  <svg width={size} height={Math.round((size * 60) / 88)} viewBox="0 0 88 60" aria-hidden className={`block ${still ? '' : 'tractor-buddy'}`}>
    {!still && (
      <>
        <path d="M0 57 Q6 53 12 57" stroke="rgb(var(--c-terracotta) / 0.45)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle className="tractor-puff" cx="64" cy="10" r="4" fill="rgb(var(--c-ink-muted) / 0.35)" />
        <circle className="tractor-puff tractor-puff-late" cx="64" cy="10" r="3" fill="rgb(var(--c-ink-muted) / 0.35)" />
      </>
    )}
    <g className={still ? '' : 'tractor-body'}>
      <rect x="61" y="14" width="5" height="14" rx="1.5" fill="rgb(var(--c-ink))" />
      <rect x="38" y="26" width="38" height="16" rx="4" fill="rgb(var(--c-mustard))" />
      <rect x="72" y="30" width="5" height="6" rx="1.5" fill="rgb(var(--c-paper))" />
      <rect x="16" y="6" width="30" height="5" rx="2.5" fill="rgb(var(--c-ink))" />
      <rect x="18" y="9" width="26" height="33" rx="4" fill="rgb(var(--c-terracotta))" />
      <rect x="22" y="13" width="18" height="14" rx="2.5" fill="rgb(var(--c-paper))" />
      <circle cx="28" cy="19" r="2.4" fill="rgb(var(--c-ink))" />
      <circle cx="35" cy="19" r="2.4" fill="rgb(var(--c-ink))" />
      <path d="M28 23.5 Q31.5 26.5 35 23.5" stroke="rgb(var(--c-ink))" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
    <g className={still ? '' : 'tractor-wheel'}>
      <circle cx="27" cy="44" r="14" fill="rgb(var(--c-ink))" />
      <circle cx="27" cy="44" r="6" fill="rgb(var(--c-paper))" />
      <path d="M27 30 V36 M27 52 V58 M13 44 H19 M35 44 H41" stroke="rgb(var(--c-paper) / 0.5)" strokeWidth="2.5" />
    </g>
    <g className={still ? '' : 'tractor-wheel'}>
      <circle cx="68" cy="50" r="8.5" fill="rgb(var(--c-ink))" />
      <circle cx="68" cy="50" r="3.2" fill="rgb(var(--c-paper))" />
      <path d="M68 41.5 V45 M68 55 V58.5" stroke="rgb(var(--c-paper) / 0.5)" strokeWidth="2" />
    </g>
  </svg>
);

/**
 * Вход в игры с карты: крестик и нолик с табличкой «Сыграем?» в левом нижнем углу.
 * Справа на карте уже донат и ⚡, поэтому слева
 */
export const GamesMascot: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [small, setSmall] = useState(readSmall);
  const [kind] = useState(sessionKind);
  const [phrase] = useState(() => sessionPhrase(kind === 'tractor' ? TRACTOR_PHRASES : PHRASES));
  const open = () => {
    telegramService.haptic('light');
    onOpen();
  };

  if (small) {
    return (
      <button
        onClick={open}
        aria-label="Открыть игры"
        className="absolute left-4 bottom-[52px] z-20 w-14 h-14 rounded-full bg-zine-cardElevated border border-zine-border shadow-zine-float dark:bg-[#433C36] dark:border-white/25 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
      >
        {kind === 'tractor' ? (
          <TractorBuddy size={36} still />
        ) : (
          <svg width="32" height="18" viewBox="0 0 30 16" aria-hidden>
            <path d="M2 2 L12 14 M12 2 L2 14" stroke="rgb(var(--c-terracotta))" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="22" cy="8" r="5.5" stroke="rgb(var(--c-mustard))" strokeWidth="3.5" fill="none" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="absolute left-3 bottom-[44px] z-20">
      <button onClick={open} aria-label="Открыть игры" className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform">
        <span className="mascot-sign px-3 py-1 rounded-zine-sm bg-zine-paper text-zine-ink text-sm2 font-bold border-2 border-zine-ink shadow-zine-sm whitespace-nowrap">{phrase}</span>
        {kind === 'tractor' ? (
          <span className="mascot-stroll mt-1.5 flex items-end">
            <TractorBuddy />
          </span>
        ) : (
          <span className="mascot-stroll mt-0.5 flex items-end gap-1">
            <span className="mascot-sway">
              <Cross />
            </span>
            <span className="mascot-sway mascot-sway-late">
              <Nought />
            </span>
          </span>
        )}
      </button>
      <button
        onClick={() => {
          telegramService.haptic('selection');
          shrinkGamesMascot();
          setSmall(true);
        }}
        aria-label={kind === 'tractor' ? 'Убрать трактор' : 'Убрать человечков'}
        className="absolute -top-2.5 -right-3 w-6 h-6 rounded-full bg-zine-cardElevated border border-zine-border text-zine-inkMuted text-[13px] leading-none flex items-center justify-center cursor-pointer before:absolute before:-inset-2.5 before:content-['']"
      >
        ×
      </button>
    </div>
  );
};
