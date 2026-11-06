import React from 'react';

// Конфетти и эмодзи поверх экрана: при победе — салют из центра и дождь конфетти, при проигрыше — медленно падают 💀😭🥀,
// при ничьей — 🤝. Нажатия проходят насквозь. При «уменьшить движение» в системе не показываем
const CONFETTI = ['--c-terracotta', '--c-mustard', '--c-sage', '--c-plum', '--c-sky', '--c-blush'];
export const Celebration: React.FC<{ kind: 'win' | 'lose' | 'draw' }> = ({ kind }) => {
  const parts = React.useMemo(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const out: { cls: string; style: React.CSSProperties; content?: string }[] = [];
    if (kind === 'win') {
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 2;
        const dist = rnd(110, 190);
        out.push({
          cls: 'game-burst rounded-sm',
          style: { width: 9, height: 14, background: `rgb(var(${CONFETTI[i % CONFETTI.length]}))`, '--bx': `${Math.cos(angle) * dist}px`, '--by': `${Math.sin(angle) * dist}px`, '--rot': `${rnd(-360, 360)}deg`, '--delay': `${rnd(0, 0.12)}s` } as React.CSSProperties
        });
      }
      for (let i = 0; i < 46; i++) {
        const emoji = i % 6 === 0 ? ['🎉', '✨', '🔥', '⭐'][i % 4] : '';
        out.push({
          cls: `game-fall ${emoji ? 'text-[24px]' : 'rounded-sm'}`,
          content: emoji,
          style: {
            left: `${rnd(0, 100)}%`,
            ...(emoji ? {} : { width: rnd(7, 11), height: rnd(10, 16), background: `rgb(var(${CONFETTI[i % CONFETTI.length]}))` }),
            '--dx': `${rnd(-60, 60)}px`, '--rot': `${rnd(-540, 540)}deg`, '--dur': `${rnd(2.2, 3.6)}s`, '--delay': `${rnd(0.2, 1.2)}s`
          } as React.CSSProperties
        });
      }
    } else {
      const set = kind === 'lose' ? ['💀', '😭', '🥀', '🫠', '🙈'] : ['🤝', '✨'];
      const n = kind === 'lose' ? 18 : 12;
      for (let i = 0; i < n; i++) {
        out.push({
          cls: 'game-fall',
          content: set[i % set.length],
          style: { left: `${rnd(2, 92)}%`, fontSize: rnd(26, 40), '--dx': `${rnd(-30, 30)}px`, '--rot': `${rnd(-90, 90)}deg`, '--dur': `${rnd(2.8, 4.2)}s`, '--delay': `${rnd(0, 1.2)}s` } as React.CSSProperties
        });
      }
    }
    return out;
  }, [kind]);
  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden" aria-hidden>
      {parts.map((p, i) => (
        <span key={i} className={p.cls} style={p.style}>
          {p.content}
        </span>
      ))}
    </div>
  );
};
