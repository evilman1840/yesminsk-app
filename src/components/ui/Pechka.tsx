import React from 'react';
import { DONUT, DONUT_VIEWBOX, TIER_SVG } from './donuts';

/**
 * Печка ГУЛЯЙ — персонаж сериала «Не Одна Дома», на ней «работает» приложение.
 * Её кормят донатами — пончиками 🍩. Настроение — от цели месяца:
 * hungry < 30%, ok 30–80%, happy > 80%, eating — сразу после доната.
 * Цвета свои, одинаковые в светлой и тёмной теме
 */
export type PechkaMood = 'hungry' | 'ok' | 'happy' | 'eating';

export const moodFor = (filledPercent: number | null): PechkaMood =>
  filledPercent === null ? 'ok' : filledPercent < 30 ? 'hungry' : filledPercent > 80 ? 'happy' : 'ok';

const LINE = '#2B2623';
const FLAME = { hungry: 0.45, ok: 0.8, happy: 1.05, eating: 1 };

const Eyes: React.FC<{ mood: PechkaMood }> = ({ mood }) => {
  if (mood === 'happy')
    return <path d="M54 72 Q64 60 74 72 M86 72 Q96 60 106 72" stroke={LINE} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  if (mood === 'eating')
    return <path d="M54 70 Q64 76 74 70 M86 70 Q96 76 106 70" stroke={LINE} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  const y = mood === 'hungry' ? 72 : 70;
  const py = mood === 'hungry' ? 77 : 73;
  const dx = mood === 'hungry' ? 0 : 2;
  return (
    <>
      <g className="pechka-blink">
        <ellipse cx="64" cy={y} rx="10" ry={mood === 'hungry' ? 11 : 12} fill="#fff" stroke={LINE} strokeWidth="2.5" />
        <ellipse cx="96" cy={y} rx="10" ry={mood === 'hungry' ? 11 : 12} fill="#fff" stroke={LINE} strokeWidth="2.5" />
        <circle cx={64 + dx} cy={py} r="4.5" fill={LINE} />
        <circle cx={96 + dx} cy={py} r="4.5" fill={LINE} />
      </g>
      {mood === 'hungry' && (
        <>
          <path d="M53 66 Q64 70 75 64 M85 64 Q96 70 107 66" stroke={LINE} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M118 58 q4 8 0 11 q-4 -3 0 -11z" fill="#8EC5E8" stroke={LINE} strokeWidth="1.5" />
        </>
      )}
    </>
  );
};

export const Pechka: React.FC<{ mood?: PechkaMood; size?: number; className?: string }> = ({ mood = 'ok', size = 110, className = '' }) => {
  const cheeks = mood === 'hungry' ? 3 : mood === 'eating' ? 10 : 7;
  const fire = FLAME[mood];
  return (
    <svg width={size} height={Math.round((size * 206) / 172)} viewBox="-6 -12 172 206" aria-hidden className={`block ${className}`}>
      <g className={mood === 'hungry' ? 'pechka-shake' : ''}>
        {mood === 'happy' ? (
          <>
            <path className="pechka-puff" d="M107 10 c-4 -6 -12 -2 -8 4 l8 7 8 -7 c4 -6 -4 -10 -8 -4z" fill="#E88B74" />
            <path className="pechka-puff pechka-puff-late" d="M114 6 c-3 -4 -9 -1 -6 3 l6 5 6 -5 c3 -4 -3 -7 -6 -3z" fill="#E88B74" />
          </>
        ) : mood === 'hungry' ? (
          <circle className="pechka-puff" cx="107" cy="6" r="5" fill="#B2A9A0" />
        ) : (
          <>
            <circle className="pechka-puff" cx="107" cy="6" r="8" fill="#B2A9A0" />
            <circle className="pechka-puff pechka-puff-late" cx="112" cy="4" r="6" fill="#B2A9A0" />
          </>
        )}
        <rect x="96" y="10" width="22" height="38" rx="3" fill="#D95C3C" stroke={LINE} strokeWidth="3" />
        <rect x="22" y="40" width="116" height="132" rx="18" fill={mood === 'hungry' ? '#EFE7DD' : '#FFF4E6'} stroke={LINE} strokeWidth="3" />
        <path d="M22 84 H138 M22 128 H138 M61 40 V172 M99 40 V172" stroke="#EED6BF" strokeWidth="2" />
        <g fill="#D95C3C" opacity=".55">
          <path d="M41 58 l4 4 -4 4 -4 -4z" />
          <path d="M119 58 l4 4 -4 4 -4 -4z" />
          <path d="M41 150 l4 4 -4 4 -4 -4z" />
          <path d="M119 150 l4 4 -4 4 -4 -4z" />
        </g>
        <Eyes mood={mood} />
        <circle cx="46" cy="92" r={cheeks} fill="#E88B74" opacity=".5" />
        <circle cx="114" cy="92" r={cheeks} fill="#E88B74" opacity=".5" />
        <g className={mood === 'eating' ? 'pechka-chew' : ''}>
          <rect x="50" y="100" width="60" height="46" rx="12" fill={LINE} stroke={LINE} strokeWidth="3" />
          <g transform={`translate(80 140) scale(${fire}) translate(-80 -140)`}>
            <g className="pechka-flame">
              <path d="M80 138 C64 138 62 124 70 116 C70 124 76 124 76 118 C76 110 82 106 84 102 C86 112 96 116 94 128 C92 136 86 138 80 138Z" fill="#E2A03F" />
              <path d="M80 136 C73 136 72 128 76 124 C78 128 82 128 82 124 C86 128 88 136 80 136Z" fill="#D95C3C" />
            </g>
          </g>
        </g>
        {mood === 'eating' && (
          <>
            <g transform="translate(64 98) rotate(-12) scale(.85)" dangerouslySetInnerHTML={{ __html: DONUT }} />
            <g fill="#E2A03F">
              <circle cx="46" cy="152" r="2.5" />
              <circle cx="116" cy="150" r="2" />
              <circle cx="108" cy="158" r="2.5" />
            </g>
          </>
        )}
        <rect x="38" y="170" width="14" height="18" rx="4" fill={LINE} />
        <rect x="108" y="170" width="14" height="18" rx="4" fill={LINE} />
      </g>
    </svg>
  );
};

// Пончик 42×38 — для шкалы цели месяца; пустой — пунктирное колечко
export const Donut: React.FC<{ empty?: boolean; className?: string }> = ({ empty, className = '' }) =>
  empty ? (
    <svg viewBox={DONUT_VIEWBOX} aria-hidden className={`block w-full h-auto ${className}`}>
      <ellipse cx="20" cy="20" rx="17" ry="13" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      <ellipse cx="20" cy="19" rx="5" ry="3.6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2.5" />
    </svg>
  ) : (
    <svg viewBox={DONUT_VIEWBOX} aria-hidden className={`block w-full h-auto ${className}`} dangerouslySetInnerHTML={{ __html: DONUT }} />
  );

// Подсказки суммы: пончик, тарелка, коробка, гора пончиков
export type TierKind = keyof typeof TIER_SVG;
export const TierIcon: React.FC<{ kind: TierKind }> = ({ kind }) => (
  <svg viewBox={TIER_SVG[kind].viewBox} height="30" aria-hidden className="block max-w-full" dangerouslySetInnerHTML={{ __html: TIER_SVG[kind].html }} />
);
