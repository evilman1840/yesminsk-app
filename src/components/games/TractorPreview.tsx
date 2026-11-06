import React, { useEffect, useRef } from 'react';
import { TractorSim, TRAIL_W } from '../../games/tractors';
import { W, H, drawMap } from '../../games/tractorMap';
import { readPalette, drawTractor } from './TractorGame';

/**
 * Картинка для меню и стартового экрана «Трактора в Минске»: настоящая карта со случайной расстановкой,
 * по которой четыре бота уже успели проехать пару секунд. Рисуется один раз, без анимации.
 * Заполняет блок целиком (лишнее обрезается по краям), как фото в карточке.
 */
export const TractorPreview: React.FC<{ className?: string; seconds?: number }> = ({ className = '', seconds = 2.6 }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<TractorSim | null>(null);

  if (!simRef.current) {
    const sim = new TractorSim([0.8, 0.7, 0.6, 0.75].map((skill, i) => ({ name: `${i}`, bot: true, skill })));
    sim.startRound();
    for (let i = 0; i < seconds * 120 && !sim.over; i++) sim.step(1 / 120);
    simRef.current = sim;
  }

  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, sim = simRef.current;
    if (!wrap || !canvas || !sim) return;
    const draw = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      const pal = readPalette();
      const s = Math.max(r.width / W, r.height / H) * 1.15; // чуть крупнее, чем «вписать»: виден центр поля
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(s * dpr, 0, 0, s * dpr, (r.width / 2 - (W / 2) * s) * dpr, (r.height / 2 - (H / 2) * s) * dpr);
      drawMap(ctx, pal, sim.layout);
      ctx.lineCap = 'round';
      ctx.lineWidth = TRAIL_W;
      for (const g of sim.segs) {
        ctx.strokeStyle = pal.players[g.id];
        ctx.beginPath();
        ctx.moveTo(g.x0, g.y0);
        ctx.lineTo(g.x1, g.y1);
        ctx.stroke();
      }
      sim.tractors.forEach((t) => drawTractor(ctx, t, pal.players[t.id], pal));
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    document.fonts?.ready.then(draw).catch(() => {});
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className.includes('absolute') ? '' : 'relative'} ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 block" />
    </div>
  );
};
