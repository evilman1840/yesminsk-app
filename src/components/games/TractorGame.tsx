import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, HelpCircle, CornerUpLeft, CornerUpRight } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { TractorSim, Tractor, Turn, TRAIL_W, WIN_SCORE, RUSH_AT } from '../../games/tractors';
import { W, H, drawMap, MapPalette } from '../../games/tractorMap';
import { TRACTOR_TEXTS as T } from '../../texts/tractors';

/**
 * «Минский час пик»: ты и три бота на схеме Минска. Целиком в приложении, сервер не нужен.
 * Рисуем на canvas: карта и борозды — в отдельных слоях (борозды дорисовываем по кусочку), тракторы — каждый кадр.
 * Считаем шагами по 1/120 секунды, чтобы игра шла одинаково на любом телефоне.
 */

type Phase = 'countdown' | 'running' | 'roundOver' | 'matchOver';
const COLOR_NAMES = ['terracotta', 'sky', 'sage', 'plum'];
const STEP = 1 / 120;
const RULES_KEY = 'yesminsk_tractor_rules_seen';

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* приватный режим */
    }
  }
};

type Palette = MapPalette & { players: string[]; danger: string };

function readPalette(): Palette {
  const st = getComputedStyle(document.documentElement);
  const raw = (n: string) => st.getPropertyValue(`--c-${n}`).trim().split(/\s+/).map(Number);
  const rgb = (n: string) => {
    const v = raw(n);
    return v.length === 3 && v.every((x) => !Number.isNaN(x)) ? `rgb(${v.join(',')})` : '#888';
  };
  const paper = raw('paper');
  return {
    paper: rgb('paper'),
    card: rgb('card'),
    cardElevated: rgb('card-elevated'),
    border: rgb('border'),
    ink: rgb('ink'),
    inkMuted: rgb('ink-muted'),
    terracotta: rgb('terracotta'),
    mustard: rgb('mustard'),
    sage: rgb('sage'),
    sky: rgb('sky'),
    danger: rgb('danger'),
    dark: paper.length === 3 && paper[0] + paper[1] + paper[2] < 300,
    players: COLOR_NAMES.map(rgb)
  };
}

function shuffle<X>(a: X[]): X[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function newSim() {
  const names = shuffle(T.bots).slice(0, 3);
  const skills = shuffle([0.88, 0.68, 0.48]);
  return new TractorSim([{ name: T.you, bot: false }, ...names.map((n, i) => ({ name: `🤖 ${n}`, bot: true, skill: skills[i] }))]);
}

// Трактор сверху, нос — по +x
function drawTractor(ctx: CanvasRenderingContext2D, t: Tractor, color: string, pal: Palette) {
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.a);
  ctx.scale(1.35, 1.35);
  if (!t.alive) ctx.globalAlpha = 0.45;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h); // старые WebView на Android
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rr(-3, -2.9, 7.2, 6.2, 1.2);
  ctx.fillStyle = pal.ink;
  rr(-3.3, -3.4, 3.6, 1.5, 0.5); // задние колёса
  rr(-3.3, 1.9, 3.6, 1.5, 0.5);
  rr(1.8, -2.6, 1.8, 0.9, 0.3); // передние
  rr(1.8, 1.7, 1.8, 0.9, 0.3);
  ctx.fillStyle = color;
  rr(-1.2, -1.4, 5, 2.8, 0.7); // капот
  rr(-3, -2, 2.8, 4, 0.6); // кабина
  ctx.fillStyle = pal.paper;
  ctx.globalAlpha *= 0.8;
  rr(-2.5, -1.45, 1.7, 2.9, 0.4); // крыша-окно
  ctx.globalAlpha = t.alive ? 1 : 0.45;
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(1.4, -0.75, 0.45, 0, Math.PI * 2); // труба
  ctx.fill();
  ctx.restore();

  if (!t.alive) {
    // Вспышка на месте аварии
    const fx = t.x + Math.cos(t.a) * 4, fy = t.y + Math.sin(t.a) * 4;
    ctx.save();
    ctx.fillStyle = pal.danger;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const r = k % 2 ? 1.6 : 4;
      const a = (k * Math.PI) / 8;
      ctx.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export const TractorGame: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const simRef = useRef<TractorSim>(null as unknown as TractorSim);
  if (!simRef.current) {
    simRef.current = newSim();
    simRef.current.startRound();
  }
  const [phase, setPhaseState] = useState<Phase>('countdown');
  const phaseRef = useRef<Phase>('countdown');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [roundKey, setRoundKey] = useState(0);
  const [count, setCount] = useState(3);
  const [go, setGo] = useState(false);
  const [alive, setAlive] = useState<boolean[]>([true, true, true, true]);
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0]);
  const [roundWinner, setRoundWinner] = useState<number | null>(null);
  const [rush, setRush] = useState(false);
  const rushRef = useRef(false);
  const [rulesOpen, setRulesOpen] = useState(() => store.get(RULES_KEY) !== '1');
  const rulesRef = useRef(rulesOpen);
  rulesRef.current = rulesOpen;
  const [pressed, setPressed] = useState({ l: false, r: false });
  const held = useRef({ l: false, r: false });
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useRef<{ map: HTMLCanvasElement; trail: HTMLCanvasElement; k: number; pal: Palette } | null>(null);
  const drawn = useRef(0);

  const sim = simRef.current;

  const applyTurn = () => {
    const h = held.current;
    simRef.current.setTurn(0, ((h.r ? 1 : 0) - (h.l ? 1 : 0)) as Turn);
    setPressed({ ...h });
  };
  const press = (side: 'l' | 'r', on: boolean) => {
    if (held.current[side] === on) return;
    held.current[side] = on;
    if (on) telegramService.haptic('selection');
    applyTurn();
  };

  const clearTrail = () => {
    const L = layers.current;
    if (L) L.trail.getContext('2d')!.clearRect(0, 0, L.trail.width, L.trail.height);
    drawn.current = 0;
  };

  const beginRound = () => {
    simRef.current.startRound();
    clearTrail();
    applyTurn();
    setAlive([true, true, true, true]);
    setRoundWinner(null);
    setRush(false);
    rushRef.current = false;
    setPhase('countdown');
    setRoundKey((k) => k + 1);
  };

  const newMatch = () => {
    timers.current.forEach(clearTimeout);
    simRef.current = newSim();
    setScores([0, 0, 0, 0]);
    beginRound();
  };

  // Отсчёт 3-2-1; если открыты правила — ждём
  useEffect(() => {
    if (phase !== 'countdown' || rulesOpen) return;
    setCount(3);
    telegramService.haptic('light');
    const ts = [
      window.setTimeout(() => (setCount(2), telegramService.haptic('light')), 700),
      window.setTimeout(() => (setCount(1), telegramService.haptic('light')), 1400),
      window.setTimeout(() => {
        setPhase('running');
        setGo(true);
        telegramService.haptic('medium');
      }, 2100)
    ];
    return () => ts.forEach(clearTimeout);
  }, [phase, rulesOpen, roundKey]);

  useEffect(() => {
    if (!go) return;
    const t = window.setTimeout(() => setGo(false), 700);
    return () => clearTimeout(t);
  }, [go]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // События раунда
  const onEvents = useRef<(ev: ReturnType<TractorSim['step']>) => void>(() => {});
  onEvents.current = (ev) => {
    const s = simRef.current;
    for (const e of ev) {
      if (e.type === 'crash') {
        telegramService.haptic(e.id === 0 ? 'error' : 'light');
        setAlive(s.tractors.map((t) => t.alive));
      } else {
        setScores(s.tractors.map((t) => t.score));
        setRoundWinner(e.winner);
        setPhase('roundOver');
        if (e.winner === 0) telegramService.haptic('success');
        const matchDone = s.tractors.some((t) => t.score >= WIN_SCORE);
        later(matchDone ? 1600 : 1900, () => (matchDone ? setPhase('matchOver') : beginRound()));
      }
    }
  };

  // Холст: размер по месту, карта рисуется один раз на размер
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const setup = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const s = Math.min(r.width / W, r.height / H);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pw = Math.round(W * s * dpr), ph = Math.round(H * s * dpr);
      canvas.style.width = `${W * s}px`;
      canvas.style.height = `${H * s}px`;
      canvas.width = pw;
      canvas.height = ph;
      const k = s * dpr;
      const pal = readPalette();
      const mk = () => {
        const c = document.createElement('canvas');
        c.width = pw;
        c.height = ph;
        return c;
      };
      const map = mk(), trail = mk();
      const mctx = map.getContext('2d')!;
      mctx.setTransform(k, 0, 0, k, 0, 0);
      drawMap(mctx, pal);
      layers.current = { map, trail, k, pal };
      drawn.current = 0;
    };
    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(wrap);
    document.fonts?.ready.then(setup).catch(() => {});
    const themeObs = new MutationObserver(setup);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      ro.disconnect();
      themeObs.disconnect();
    };
  }, []);

  // Игровой цикл
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = simRef.current;
      if (phaseRef.current === 'running' && !rulesRef.current) {
        acc += dt * (s.tractors[0].alive ? 1 : 2.5); // выбыл — досматриваем быстрее
        while (acc >= STEP) {
          acc -= STEP;
          const ev = s.step(STEP);
          if (ev.length) onEvents.current(ev);
          if (s.over) {
            acc = 0;
            break;
          }
        }
        if (!rushRef.current && s.t >= RUSH_AT) {
          rushRef.current = true;
          setRush(true);
          telegramService.haptic('warning');
        }
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const draw = () => {
    const L = layers.current, canvas = canvasRef.current;
    if (!L || !canvas) return;
    const s = simRef.current;
    const { k, pal } = L;

    // Новые куски борозд — в слой борозд
    const tctx = L.trail.getContext('2d')!;
    if (drawn.current > s.segs.length) {
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, L.trail.width, L.trail.height);
      drawn.current = 0;
    }
    if (drawn.current < s.segs.length) {
      tctx.setTransform(k, 0, 0, k, 0, 0);
      tctx.lineCap = 'round';
      tctx.lineWidth = TRAIL_W;
      for (let i = drawn.current; i < s.segs.length; i++) {
        const g = s.segs[i];
        tctx.strokeStyle = pal.players[g.id];
        tctx.beginPath();
        tctx.moveTo(g.x0, g.y0);
        tctx.lineTo(g.x1, g.y1);
        tctx.stroke();
      }
      drawn.current = s.segs.length;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(L.map, 0, 0);
    ctx.drawImage(L.trail, 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const showHints = phaseRef.current === 'countdown' || (phaseRef.current === 'running' && s.t < 1.2);
    if (showHints) {
      // Куда смотрит каждый трактор
      for (const t of s.tractors) {
        const c = Math.cos(t.a), sn = Math.sin(t.a);
        ctx.save();
        ctx.strokeStyle = pal.players[t.id];
        ctx.fillStyle = pal.players[t.id];
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2.5]);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(t.x + c * 7, t.y + sn * 7);
        ctx.lineTo(t.x + c * 22, t.y + sn * 22);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(t.x + c * 26, t.y + sn * 26);
        ctx.lineTo(t.x + c * 21 - sn * 3, t.y + sn * 21 + c * 3);
        ctx.lineTo(t.x + c * 21 + sn * 3, t.y + sn * 21 - c * 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    s.tractors.forEach((t) => drawTractor(ctx, t, pal.players[t.id], pal));

    if (showHints) {
      // «Ты» над своим трактором
      const me = s.tractors[0];
      ctx.save();
      ctx.font = '700 6px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(T.you).width + 6;
      ctx.fillStyle = pal.players[0];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(me.x - w / 2, me.y - 18, w, 8, 4);
      else ctx.rect(me.x - w / 2, me.y - 18, w, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(T.you, me.x, me.y - 13.8);
      ctx.restore();
    }
  };

  // Клавиатура: для проверки на компьютере
  useEffect(() => {
    const key = (on: boolean) => (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') press('l', on);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') press('r', on);
      else return;
      e.preventDefault();
    };
    const down = key(true), up = key(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeRules = () => {
    store.set(RULES_KEY, '1');
    setRulesOpen(false);
  };

  const pal = layers.current?.pal;
  const colorOf = (id: number) => pal?.players[id] ?? `rgb(var(--c-${COLOR_NAMES[id]}))`;
  const nameOf = (id: number) => sim.tractors[id].name;
  const champion = phase === 'matchOver' ? sim.tractors.reduce((b, t) => (t.score > b.score ? t : b)) : null;

  const holdProps = (side: 'l' | 'r') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      press(side, true);
    },
    onPointerUp: () => press(side, false),
    onPointerCancel: () => press(side, false),
    onLostPointerCapture: () => press(side, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault()
  });

  return (
    <div className="relative flex flex-col h-full w-full bg-zine-paper overflow-hidden select-none">
      <header className="shrink-0 px-4 pt-3 pb-1 flex items-center gap-1">
        {!telegramService.isInsideTelegram() && (
          <button onClick={onExit} aria-label="Назад" className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-zine-ink cursor-pointer">
            <ArrowLeft size={24} />
          </button>
        )}
        <h1 className="flex-1 min-w-0 font-serif font-bold text-title text-zine-ink truncate">{T.title}</h1>
        <button
          onClick={() => {
            telegramService.haptic('light');
            setRulesOpen(true);
          }}
          aria-label={T.howToPlay}
          className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-zine-terracotta cursor-pointer active:opacity-70"
        >
          <HelpCircle size={24} />
        </button>
      </header>

      {/* Счёт */}
      <div className="shrink-0 px-3 pb-2 grid grid-cols-4 gap-1.5">
        {sim.tractors.map((t) => (
          <div
            key={t.id}
            className={`h-9 pl-2 pr-2.5 rounded-full border flex items-center gap-1 min-w-0 transition-opacity ${
              t.id === 0 ? 'bg-zine-cardElevated border-zine-terracotta/50' : 'bg-zine-cardElevated border-zine-border'
            } ${alive[t.id] ? '' : 'opacity-45'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(t.id) }} />
            <span className={`flex-1 min-w-0 truncate text-[12px] leading-4 font-semibold text-zine-ink ${alive[t.id] ? '' : 'line-through'}`}>
              {t.bot ? t.name.replace('🤖 ', '') : t.name}
            </span>
            <span className="text-cap font-bold tabular-nums text-zine-ink">{scores[t.id]}</span>
          </div>
        ))}
      </div>

      {/* Поле */}
      <div ref={wrapRef} className="flex-1 min-h-0 mx-3 relative flex items-center justify-center">
        <div className="relative">
          <canvas ref={canvasRef} className="block rounded-zine-sm shadow-zine-sm" />

          {phase === 'countdown' && !rulesOpen && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span key={count} className="font-serif font-bold text-[88px] leading-none text-zine-ink drop-shadow-[0_2px_0_rgb(var(--c-paper))]">
                {count}
              </span>
            </div>
          )}
          {go && phase === 'running' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="px-5 py-2 rounded-full bg-zine-terracotta text-white font-serif font-bold text-title shadow-zine">{T.go}</span>
            </div>
          )}
          {phase === 'running' && (!alive[0] || rush) && (
            <div className="absolute top-2 inset-x-2 flex flex-col items-center gap-1.5 pointer-events-none">
              {!alive[0] && <span className="px-3 py-1.5 rounded-full bg-zine-ink/85 text-zine-paper text-cap font-semibold">{T.out}</span>}
              {rush && <span className="px-3 py-1.5 rounded-full bg-zine-mustard text-white text-cap font-bold shadow-zine-sm">🚦 {T.rush}</span>}
            </div>
          )}
          {phase === 'roundOver' && roundWinner !== null && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
              <div className="px-5 py-3 rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-float text-center">
                <p className="font-serif font-bold text-title text-zine-ink">
                  {roundWinner === 0 ? T.roundYou : roundWinner < 0 ? T.roundDraw : T.roundBot(nameOf(roundWinner))}
                </p>
                <p className="mt-1 text-cap text-zine-inkMuted">{T.toWin}</p>
              </div>
            </div>
          )}
          {phase === 'matchOver' && champion && (
            <div className="absolute inset-0 flex items-center justify-center px-4 bg-zine-paper/40">
              <div className="w-full max-w-[300px] p-5 rounded-zine-lg bg-zine-cardElevated border border-zine-border shadow-zine-float text-center">
                <p className="text-[44px] leading-none">{champion.id === 0 ? '🚜' : '🤖'}</p>
                <p className="mt-2 font-serif font-bold text-title text-zine-ink">{champion.id === 0 ? T.matchYou : T.matchBot(champion.name)}</p>
                <div className="mt-3 space-y-1">
                  {[...sim.tractors]
                    .sort((a, b) => b.score - a.score)
                    .map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm2 text-zine-ink">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(t.id) }} />
                        <span className="flex-1 text-left truncate">{t.name}</span>
                        <span className="font-bold tabular-nums">{t.score}</span>
                      </div>
                    ))}
                </div>
                <button onClick={newMatch} className="mt-4 w-full h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
                  {T.again}
                </button>
                <button onClick={onExit} className="mt-1 w-full h-11 rounded-full text-zine-inkMuted text-body font-semibold cursor-pointer">
                  {T.toGames}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Кнопки руля */}
      <div className="shrink-0 grid grid-cols-2 gap-2 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        {(['l', 'r'] as const).map((side) => (
          <button
            key={side}
            {...holdProps(side)}
            aria-label={side === 'l' ? T.left : T.right}
            style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
            className={`h-24 rounded-zine-lg border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-[transform,background-color] duration-75 ${
              pressed[side] ? 'bg-zine-terracotta border-zine-terracotta text-white scale-[0.97]' : 'bg-zine-cardElevated border-zine-border text-zine-ink'
            }`}
          >
            {side === 'l' ? <CornerUpLeft size={34} strokeWidth={2.4} /> : <CornerUpRight size={34} strokeWidth={2.4} />}
            <span className="text-cap font-bold uppercase tracking-wide">{side === 'l' ? T.left : T.right}</span>
          </button>
        ))}
      </div>

      {/* Правила: сами при первом запуске, потом по «?». Игра на паузе */}
      {rulesOpen && (
        <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 px-3 pb-3">
          <div className="w-full max-w-[420px] p-5 rounded-zine-lg bg-zine-cardElevated shadow-zine-float">
            <h2 className="font-serif font-bold text-title text-zine-ink">{T.title}</h2>
            <div className="mt-3 space-y-1.5">
              {T.rulesLines.map(([icon, text]) => (
                <p key={text} className="flex items-center gap-3 font-serif font-bold text-lead text-zine-ink">
                  <span className="w-8 text-center text-[24px]">{icon}</span>
                  {text}
                </p>
              ))}
            </div>
            <p className="mt-3 text-sm2 text-zine-inkMuted">{T.rulesHow}</p>
            <button onClick={closeRules} className="mt-4 w-full h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
              {T.rulesGo}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
