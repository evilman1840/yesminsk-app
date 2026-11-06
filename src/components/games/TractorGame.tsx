import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, HelpCircle, CornerUpLeft, CornerUpRight } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { TractorSim, Tractor, Turn, Cause, TRAIL_W, WIN_SCORE, RUSH_AT } from '../../games/tractors';
import { W, H, drawMap, MapPalette, Layout, PLACES } from '../../games/tractorMap';
import { api } from '../../services/api';
import { GameSummary } from '../../games/types';
import { TRACTOR_TEXTS as T, BOTS, crashText, pick, CrashWho } from '../../texts/tractors';
import { Celebration } from './Celebration';

/**
 * «Минский час пик»: ты и три бота на схеме Минска. Целиком в приложении, сервер не нужен.
 *
 * Экран: камера едет за твоим трактором с приближением, в углу — мини-карта всего поля.
 * Во время отсчёта видно всё поле (места каждый раунд стоят по-новому), к старту камера наезжает на тебя.
 * Выбыл — камера отъезжает, досматриваем всё поле.
 *
 * Рисуем на canvas: карта и борозды — в отдельных слоях (борозды дорисовываем по кусочку), тракторы — каждый кадр.
 * Считаем шагами по 1/120 секунды, чтобы игра шла одинаково на любом телефоне.
 */

type Phase = 'countdown' | 'running' | 'roundOver' | 'matchOver';
const COLOR_NAMES = ['terracotta', 'sky', 'sage', 'plum'];
const STEP = 1 / 120;
const COUNT_MS = 1000; // на каждую цифру отсчёта
const OVERVIEW_MS = 1500; // столько в отсчёте смотрим на всё поле, потом камера наезжает
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

export type Palette = MapPalette & { players: string[]; danger: string };

export function readPalette(): Palette {
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

type Match = { sim: TractorSim; who: CrashWho[] };

function newMatch(): Match {
  const bots = shuffle(BOTS).slice(0, 3);
  const skills = shuffle([0.88, 0.68, 0.48]);
  return {
    sim: new TractorSim([{ name: T.you, bot: false }, ...bots.map((b, i) => ({ name: `🤖 ${b.n}`, bot: true, skill: skills[i] }))]),
    who: [{ me: true, gen: '', ins: '' }, ...bots.map((b) => ({ me: false, gen: b.gen, ins: b.ins }))]
  };
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h); // старые WebView на Android
};

// Трактор сверху, нос — по +x
export function drawTractor(ctx: CanvasRenderingContext2D, t: Tractor, color: string, pal: Palette) {
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.a);
  ctx.scale(1.35, 1.35);
  const a = t.alive ? 1 : 0.45;
  ctx.globalAlpha = a;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    roundRect(ctx, x, y, w, h, r);
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
  ctx.globalAlpha = a * 0.8;
  rr(-2.5, -1.45, 1.7, 2.9, 0.4); // крыша-окно
  ctx.globalAlpha = a;
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
      const an = (k * Math.PI) / 8;
      ctx.lineTo(fx + Math.cos(an) * r, fy + Math.sin(an) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

type Layers = { map: HTMLCanvasElement; trail: HTMLCanvasElement; res: number; pal: Palette; cw: number; ch: number; dpr: number; layout: Layout | null };

export const TractorGame: React.FC<{ onExit: () => void; onSaved?: (s: GameSummary) => void }> = ({ onExit, onSaved }) => {
  const matchRef = useRef<Match>(null as unknown as Match);
  if (!matchRef.current) {
    matchRef.current = newMatch();
    matchRef.current.sim.startRound();
  }
  const [phase, setPhaseState] = useState<Phase>('countdown');
  const phaseRef = useRef<Phase>('countdown');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [roundKey, setRoundKey] = useState(0);
  const [count, setCount] = useState(3);
  const countStart = useRef(0);
  const [go, setGo] = useState(false);
  const [alive, setAlive] = useState<boolean[]>([true, true, true, true]);
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0]);
  // Итог раунда: заголовок и строка «кто во что врезался» — выбираем шутку один раз
  const [roundResult, setRoundResult] = useState<{ title: string; line: string; win: boolean } | null>(null);
  const [myCrash, setMyCrash] = useState<string | null>(null);
  const lastCrash = useRef('');
  const myLine = useRef('');
  const [matchResult, setMatchResult] = useState<{ title: string; sub: string; win: boolean; key: string } | null>(null);
  const [rush, setRush] = useState(false);
  const rushRef = useRef(false);
  const [rulesOpen, setRulesOpen] = useState(false); // правила на первом экране; здесь — только по «?»
  // Итог матча для рейтинга: раунды, дольше всего на ходу, обо что врезался
  const stats = useRef({ rounds: 0, best: 0, crash: {} as Record<string, number> });
  const [dayPlace, setDayPlace] = useState<number | null | 'saving'>(null);
  const rulesRef = useRef(rulesOpen);
  rulesRef.current = rulesOpen;
  const [pressed, setPressed] = useState({ l: false, r: false });
  const held = useRef({ l: false, r: false });
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useRef<Layers | null>(null);
  const drawn = useRef(0);
  const cam = useRef({ x: W / 2, y: H / 2, s: 0 });

  const { sim, who } = matchRef.current;

  const applyTurn = () => {
    const h = held.current;
    matchRef.current.sim.setTurn(0, ((h.r ? 1 : 0) - (h.l ? 1 : 0)) as Turn);
    setPressed({ ...h });
  };
  const press = (side: 'l' | 'r', on: boolean) => {
    if (held.current[side] === on) return;
    held.current[side] = on;
    if (on) telegramService.haptic('selection');
    applyTurn();
  };

  const beginRound = () => {
    matchRef.current.sim.startRound();
    drawn.current = Number.MAX_SAFE_INTEGER; // слой борозд очистится в следующем кадре
    applyTurn();
    setAlive([true, true, true, true]);
    setRoundResult(null);
    setMyCrash(null);
    lastCrash.current = '';
    myLine.current = '';
    setRush(false);
    rushRef.current = false;
    setPhase('countdown');
    setRoundKey((k) => k + 1);
  };

  const startNewMatch = () => {
    timers.current.forEach(clearTimeout);
    matchRef.current = newMatch();
    stats.current = { rounds: 0, best: 0, crash: {} };
    setDayPlace(null);
    setScores([0, 0, 0, 0]);
    setMatchResult(null);
    beginRound();
  };

  // Отсчёт 3-2-1; если открыты правила — ждём
  useEffect(() => {
    if (phase !== 'countdown' || rulesOpen) return;
    setCount(3);
    countStart.current = performance.now();
    telegramService.haptic('light');
    const ts = [
      window.setTimeout(() => (setCount(2), telegramService.haptic('light')), COUNT_MS),
      window.setTimeout(() => (setCount(1), telegramService.haptic('light')), COUNT_MS * 2),
      window.setTimeout(() => {
        setPhase('running');
        setGo(true);
        telegramService.haptic('medium');
      }, COUNT_MS * 3)
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
    const { sim: s, who: w } = matchRef.current;
    for (const e of ev) {
      if (e.type === 'crash') {
        const other = e.cause.k === 'trail' ? w[e.cause.owner] : e.cause.k === 'tractor' ? w[e.cause.other] : undefined;
        const line = crashText(w[e.id], e.cause as Cause, other);
        lastCrash.current = line;
        if (e.id === 0) {
          const key = e.cause.k === 'place' ? PLACES[e.cause.place].id : e.cause.k;
          stats.current.crash[key] = (stats.current.crash[key] || 0) + 1;
          stats.current.best = Math.max(stats.current.best, s.t);
          telegramService.haptic('error');
          myLine.current = line;
          setMyCrash(line);
        } else telegramService.haptic('light');
        setAlive(s.tractors.map((t) => t.alive));
      } else {
        setScores(s.tractors.map((t) => t.score));
        const win = e.winner === 0;
        stats.current.rounds++;
        if (win) stats.current.best = Math.max(stats.current.best, s.t);
        setRoundResult({
          title: win ? pick(T.roundWin) : e.winner < 0 ? pick(T.roundDraw) : T.roundLose(s.tractors[e.winner].name),
          // Своя авария важнее; выиграл — расскажем, как вылетел последний соперник
          line: (!win && myLine.current) || lastCrash.current,
          win
        });
        setPhase('roundOver');
        if (win) telegramService.haptic('success');
        const champ = s.tractors.find((t) => t.score >= WIN_SCORE);
        if (champ) {
          // В рейтинг дня: ответ придёт, пока показываем итог раунда
          setDayPlace('saving');
          const st = stats.current;
          api
            .tractorMatch({ won: champ.id === 0, rounds: st.rounds, roundWins: s.tractors[0].score, best: Math.round(st.best), crash: st.crash })
            .then((sum) => {
              onSaved?.(sum);
              setDayPlace(sum.tractor.day.myPlace);
            })
            .catch(() => setDayPlace(null));
          later(1900, () => {
            const iWon = champ.id === 0;
            setMatchResult({
              title: iWon ? pick(T.matchWin) : T.matchLose(champ.name),
              sub: pick(iWon ? T.matchWinSub : T.matchLoseSub),
              win: iWon,
              key: `${Date.now()}`
            });
            telegramService.haptic(iWon ? 'success' : 'warning');
            setPhase('matchOver');
          });
        } else later(2300, beginRound);
      }
    }
  };

  // Холст: на всё место; слои карты и борозд — в разрешении приближенной камеры
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const setup = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = r.width, ch = r.height;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      const res = Math.min(followScale(cw, ch) * dpr, 6);
      const mk = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(W * res);
        c.height = Math.round(H * res);
        return c;
      };
      layers.current = { map: mk(), trail: mk(), res, pal: readPalette(), cw, ch, dpr, layout: null };
      drawn.current = Number.MAX_SAFE_INTEGER;
      cam.current.s = 0; // встать на место без плавного наезда
    };
    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(wrap);
    document.fonts?.ready.then(() => layers.current && (layers.current.layout = null)).catch(() => {});
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
      const s = matchRef.current.sim;
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
      draw(dt, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = (dt: number, now: number) => {
    const L = layers.current, canvas = canvasRef.current;
    if (!L || !canvas) return;
    const s = matchRef.current.sim;
    const { res, pal, cw, ch, dpr } = L;

    // Карта: перерисовываем, когда места переехали
    if (L.layout !== s.layout) {
      const mctx = L.map.getContext('2d')!;
      mctx.setTransform(res, 0, 0, res, 0, 0);
      drawMap(mctx, pal, s.layout);
      L.layout = s.layout;
    }

    // Новые куски борозд — в слой борозд
    const tctx = L.trail.getContext('2d')!;
    if (drawn.current > s.segs.length) {
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, L.trail.width, L.trail.height);
      drawn.current = 0;
    }
    if (drawn.current < s.segs.length) {
      tctx.setTransform(res, 0, 0, res, 0, 0);
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

    // Камера: всё поле или за своим трактором
    const me = s.tractors[0];
    const ph = phaseRef.current;
    const sFit = Math.min(cw / W, ch / H);
    const follow =
      me.alive && !rulesRef.current && (ph === 'running' || (ph === 'countdown' && now - countStart.current > OVERVIEW_MS));
    const c = cam.current;
    const ts = follow ? followScale(cw, ch) : sFit;
    const tx = follow ? me.x + Math.cos(me.a) * 14 : W / 2;
    const ty = follow ? me.y + Math.sin(me.a) * 14 : H / 2;
    if (!c.s) Object.assign(c, { s: ts, x: tx, y: ty });
    const kS = Math.min(1, dt * 3.5), kP = Math.min(1, dt * (follow ? 7 : 3.5));
    c.s += (ts - c.s) * kS;
    c.x += (tx - c.x) * kP;
    c.y += (ty - c.y) * kP;
    const vw = cw / c.s, vh = ch / c.s;
    const cx = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, c.x));
    const cy = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, c.y));

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.card;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = c.s * dpr;
    ctx.setTransform(k, 0, 0, k, (cw / 2 - cx * c.s) * dpr, (ch / 2 - cy * c.s) * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(L.map, 0, 0, W, H);
    ctx.drawImage(L.trail, 0, 0, W, H);

    const showHints = ph === 'countdown' || (ph === 'running' && s.t < 1.2);
    if (showHints) {
      // Куда смотрит каждый трактор
      for (const t of s.tractors) {
        const co = Math.cos(t.a), sn = Math.sin(t.a);
        ctx.save();
        ctx.strokeStyle = pal.players[t.id];
        ctx.fillStyle = pal.players[t.id];
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2.5]);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(t.x + co * 7, t.y + sn * 7);
        ctx.lineTo(t.x + co * 22, t.y + sn * 22);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(t.x + co * 26, t.y + sn * 26);
        ctx.lineTo(t.x + co * 21 - sn * 3, t.y + sn * 21 + co * 3);
        ctx.lineTo(t.x + co * 21 + sn * 3, t.y + sn * 21 - co * 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    s.tractors.forEach((t) => drawTractor(ctx, t, pal.players[t.id], pal));

    if (showHints) {
      // «Ты» над своим трактором
      ctx.save();
      ctx.font = '700 6px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(T.you).width + 6;
      ctx.fillStyle = pal.players[0];
      roundRect(ctx, me.x - w / 2, me.y - 18, w, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(T.you, me.x, me.y - 13.8);
      ctx.restore();
    }

    // Мини-карта: когда камера приближена, видно всё поле и соперников
    const zoomed = c.s > sFit * 1.15;
    if (zoomed) {
      const mw = 64, mh = (mw * H) / W, mx = cw - mw - 8, my = 8;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (c.s / sFit - 1.15) * 3);
      ctx.fillStyle = pal.cardElevated;
      roundRect(ctx, mx - 3, my - 3, mw + 6, mh + 6, 8);
      ctx.fill();
      ctx.save();
      roundRect(ctx, mx, my, mw, mh, 5);
      ctx.clip();
      ctx.drawImage(L.map, mx, my, mw, mh);
      ctx.drawImage(L.trail, mx, my, mw, mh);
      // где сейчас камера
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(mx + ((cx - vw / 2) / W) * mw, my + ((cy - vh / 2) / H) * mh, (vw / W) * mw, (vh / H) * mh);
      ctx.restore();
      for (const t of s.tractors) {
        if (!t.alive) continue;
        ctx.fillStyle = pal.players[t.id];
        ctx.strokeStyle = t.id === 0 ? '#fff' : pal.cardElevated;
        ctx.lineWidth = t.id === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(mx + (t.x / W) * mw, my + (t.y / H) * mh, t.id === 0 ? 3.2 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
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
  const shortName = (t: Tractor) => (t.bot ? t.name.replace('🤖 ', '') : t.name);

  // Места в матче: по очкам; равные очки — одно место
  const ranking = [...sim.tractors].sort((a, b) => b.score - a.score);
  const placeOf = (t: Tractor) => ranking.findIndex((r) => r.score === t.score);

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
      <header className="shrink-0 px-4 pt-2 flex items-center gap-1">
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
      <div className="shrink-0 px-3 pb-2 flex gap-1.5">
        {sim.tractors.map((t) => (
          <div
            key={t.id}
            className={`flex-auto h-9 pl-2 pr-2.5 rounded-full border flex items-center gap-1 min-w-0 transition-opacity ${
              t.id === 0 ? 'bg-zine-cardElevated border-zine-terracotta/50' : 'bg-zine-cardElevated border-zine-border'
            } ${alive[t.id] ? '' : 'opacity-45'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(t.id) }} />
            <span className={`flex-1 min-w-0 truncate text-[12px] leading-4 font-semibold text-zine-ink ${alive[t.id] ? '' : 'line-through'}`}>{shortName(t)}</span>
            <span key={scores[t.id]} className={`text-cap font-bold tabular-nums text-zine-ink ${scores[t.id] ? 'game-pop' : ''}`}>
              {scores[t.id]}
            </span>
          </div>
        ))}
      </div>

      {/* Поле */}
      <div ref={wrapRef} className="flex-1 min-h-0 mx-3 relative rounded-zine overflow-hidden shadow-zine-sm">
        <canvas ref={canvasRef} className="absolute inset-0 block" />

        {phase === 'countdown' && !rulesOpen && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span key={count} className="game-pop font-serif font-bold text-[88px] leading-none text-zine-ink drop-shadow-[0_2px_0_rgb(var(--c-paper))]">
                {count}
              </span>
            </div>
            <div className="absolute bottom-3 inset-x-3 flex justify-center pointer-events-none">
              <span className="px-3 py-1.5 rounded-full bg-zine-cardElevated/95 border border-zine-border text-cap font-semibold text-zine-ink text-center shadow-zine-sm">
                {T.newMap}
              </span>
            </div>
          </>
        )}
        {go && phase === 'running' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="game-pop px-5 py-2 rounded-full bg-zine-terracotta text-white font-serif font-bold text-title shadow-zine">{T.go}</span>
          </div>
        )}
        {phase === 'running' && (myCrash || rush) && (
          <div className="absolute top-2 left-2 right-[84px] flex flex-col items-start gap-1.5 pointer-events-none">
            {myCrash && (
              <span key={myCrash} className="game-shake px-3 py-1.5 rounded-zine-sm bg-zine-ink/90 text-zine-paper text-cap font-semibold">
                💥 {myCrash}. {T.watching}
              </span>
            )}
            {rush && <span className="px-3 py-1.5 rounded-full bg-zine-mustard text-white text-cap font-bold shadow-zine-sm">🚦 {T.rush}</span>}
          </div>
        )}
        {phase === 'roundOver' && roundResult && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
            <div className="game-pop w-full max-w-[320px] px-5 py-4 rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-float text-center">
              <p className="text-[36px] leading-none">{roundResult.win ? <span className="tractor-drive">🚜</span> : <span className="game-wobble inline-block">💥</span>}</p>
              <p className="mt-2 font-serif font-bold text-title text-zine-ink">{roundResult.title}</p>
              {roundResult.line && <p className="mt-1 text-sm2 text-zine-inkMuted">{roundResult.line}</p>}
              <p className="mt-2 text-cap font-semibold text-zine-inkMuted">{T.toWin}</p>
            </div>
          </div>
        )}
        {phase === 'matchOver' && matchResult && (
          <div className="absolute inset-0 flex items-center justify-center px-4 bg-zine-paper/50">
            <div className="game-pop w-full max-w-[320px] p-5 rounded-zine-lg bg-zine-cardElevated border border-zine-border shadow-zine-float text-center">
              <p className="text-[52px] leading-none">
                {matchResult.win ? <span className="game-trophy inline-block">🏆</span> : <span className="game-wobble inline-block">🤖</span>}
              </p>
              <p className="mt-2 font-serif font-bold text-title text-zine-ink">{matchResult.title}</p>
              <p className="mt-1 text-sm2 text-zine-inkMuted">{matchResult.sub}</p>
              {dayPlace !== null && (
                <p className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zine-mustard/15 text-sm2 font-semibold text-zine-mustardInk">
                  🏆 {dayPlace === 'saving' ? T.saving : T.dayPlace(dayPlace)}
                </p>
              )}
              <div className="mt-3 space-y-1.5">
                {ranking.map((t, i) => (
                  <div
                    key={t.id}
                    className={`tractor-row flex items-center gap-2 h-10 px-3 rounded-zine-sm text-body text-zine-ink ${t.id === 0 ? 'bg-zine-terracotta/10 font-bold' : 'bg-zine-card'}`}
                    style={{ '--delay': `${0.35 + i * 0.12}s` } as React.CSSProperties}
                  >
                    <span className="w-6 text-[20px] leading-none">{T.places[placeOf(t)]}</span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(t.id) }} />
                    <span className="flex-1 text-left truncate">{t.name}</span>
                    <span className="font-bold tabular-nums">{t.score}</span>
                  </div>
                ))}
              </div>
              <button onClick={startNewMatch} className="mt-4 w-full h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
                {T.again}
              </button>
              <button onClick={onExit} className="mt-1 w-full h-11 rounded-full text-zine-inkMuted text-body font-semibold cursor-pointer">
                {T.toGames}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Кнопки руля */}
      <div className="shrink-0 grid grid-cols-2 gap-2 px-3 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        {(['l', 'r'] as const).map((side) => (
          <button
            key={side}
            {...holdProps(side)}
            aria-label={side === 'l' ? T.left : T.right}
            style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
            className={`h-20 rounded-zine-lg border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-[transform,background-color] duration-75 ${
              pressed[side] ? 'bg-zine-terracotta border-zine-terracotta text-white scale-[0.97]' : 'bg-zine-cardElevated border-zine-border text-zine-ink'
            }`}
          >
            {side === 'l' ? <CornerUpLeft size={32} strokeWidth={2.4} /> : <CornerUpRight size={32} strokeWidth={2.4} />}
            <span className="text-cap font-bold uppercase tracking-wide">{side === 'l' ? T.left : T.right}</span>
          </button>
        ))}
      </div>

      {matchResult && <Celebration key={matchResult.key} kind={matchResult.win ? 'win' : 'lose'} />}

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

// Приближение камеры: примерно 100 единиц поля по ширине экрана (поле — 200)
function followScale(cw: number, ch: number) {
  const sFit = Math.min(cw / W, ch / H);
  return Math.max(sFit * 1.3, Math.min(sFit * 2.1, cw / 100));
}
