import React, { useEffect } from 'react';
import { telegramService } from '../../services/telegram';
import { thumb } from '../../utils/thumb';

/**
 * Жребий «кто пишет первым»: монетка с двумя лицами (ты и собеседник) подлетает,
 * крутится и падает лицом того, кому выпало писать. animate=false — сразу итог, без полёта
 */

const SPINS = 5; // полных оборотов в полёте

const Face: React.FC<{ src: string; label: string; back?: boolean }> = ({ src, label, back }) => (
  <div className={`coin-face absolute inset-0 rounded-full p-[5px] bg-gradient-to-br from-[#F3CF7A] via-[rgb(var(--c-mustard))] to-[#B9822B] ${back ? 'coin-back' : ''}`}>
    <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-[#FFF3D6]/70 bg-zine-card">
      <img src={thumb(src)} alt={label} className="w-full h-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 pt-3 pb-1.5 bg-gradient-to-t from-black/70 to-transparent text-white text-cap font-bold text-center truncate px-2">{label}</span>
    </div>
  </div>
);

export const CoinFlip: React.FC<{
  result: 'me' | 'them';
  me: { avatarUrl?: string; label: string };
  them: { avatarUrl?: string; label: string };
  text: string;            // что решила монетка — появляется после приземления
  animate?: boolean;
  size?: number;
}> = ({ result, me, them, text, animate = true, size = 104 }) => {
  const end = SPINS * 360 + (result === 'them' ? 180 : 0);

  // Приземлилась — короткий отклик
  useEffect(() => {
    if (!animate) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => telegramService.haptic('medium'), calm ? 0 : 1450);
    return () => window.clearTimeout(t);
  }, [animate]);

  return (
    <div className="flex flex-col items-center" aria-live="polite">
      {/* Взлетает поверх текста над собой — места под полёт не резервируем */}
      <div className="coin-stage relative z-10 flex flex-col items-center pt-2">
        <div className={animate ? 'coin-toss' : ''}>
          <div
            className={`relative rounded-full ${animate ? 'coin-spin' : ''}`}
            style={{ width: size, height: size, ['--coin-end' as any]: `${end}deg`, transform: animate ? undefined : `rotateX(${end}deg)`, transformStyle: 'preserve-3d' }}
          >
            <Face src={me.avatarUrl || ''} label={me.label} />
            <Face src={them.avatarUrl || ''} label={them.label} back />
          </div>
        </div>
        <div className={`mt-2 h-2.5 rounded-full bg-zine-ink/40 blur-[3px] ${animate ? 'coin-shadow' : 'opacity-30'}`} style={{ width: size * 0.7 }} />
      </div>
      <p className={`mt-3 text-center text-lead font-bold text-zine-ink ${animate ? 'coin-result' : ''}`}>{text}</p>
    </div>
  );
};
