import { W, H, buildWalls, randomLayout, Layout, WALL_BORDER, WALL_RIVER, WALL_PLACE } from './tractorMap';

/**
 * «Минский час пик»: движок раунда. Тракторы едут сами, держишь кнопку — поворачивают.
 * Поле — клетки 1×1: в каждой записано, чья там борозда и когда её провели.
 * Свою свежую борозду (последние GRACE секунд) трактор не задевает: она у него прямо под колёсами.
 * Всё считается целиком в приложении; боты — тут же.
 */

export const SPEED = 32; // единиц в секунду: поле 200 в ширину проезжается за ~6 секунд
export const TURN_RATE = 2.6; // радиан в секунду: радиус разворота ~12
export const TRAIL_W = 2.4;
export const HIT_R = 2.4; // от центра трактора до «носа»
export const WIN_SCORE = 3;
export const RUSH_AT = 25; // с этой секунды раунда — «час пик»: все разгоняются
const GRACE = 0.3;
const TRAIL_DELAY = 0.45; // первые полсекунды без борозды, чтобы никто не вылетел сразу
const STAMP_R = TRAIL_W / 2;

export type Turn = -1 | 0 | 1;

export type Tractor = {
  id: number;
  name: string;
  bot: boolean;
  skill: number; // 0..1, только у ботов
  x: number;
  y: number;
  a: number;
  turn: Turn;
  alive: boolean;
  score: number;
  think: number;
  trail: boolean;
  lx: number;
  ly: number;
};

export type Seg = { id: number; x0: number; y0: number; x1: number; y1: number };
/** Обо что врезался: МКАД, Свислочь, место (номер в PLACES), чужая борозда, своя, другой трактор */
export type Cause =
  | { k: 'border' }
  | { k: 'river' }
  | { k: 'place'; place: number }
  | { k: 'trail'; owner: number }
  | { k: 'own' }
  | { k: 'tractor'; other: number };
export type SimEvent = { type: 'crash'; id: number; cause: Cause } | { type: 'roundEnd'; winner: number }; // winner -1 — ничья

export class TractorSim {
  tractors: Tractor[];
  owner = new Uint8Array(W * H);
  stamp = new Float32Array(W * H);
  t = 0;
  over = false;
  segs: Seg[] = []; // все отрезки борозд за раунд: по ним рисуем
  round = 0;
  layout: Layout = randomLayout(); // где стоят места в этом раунде — каждый раунд заново
  walls: Uint8Array = buildWalls(this.layout);
  causes: (Cause | null)[] = [];

  constructor(players: { name: string; bot: boolean; skill?: number }[]) {
    this.tractors = players.map((p, id) => ({
      id, name: p.name, bot: p.bot, skill: p.skill ?? 0, x: 0, y: 0, a: 0, turn: 0, alive: true, score: 0, think: 0, trail: false, lx: 0, ly: 0
    }));
  }

  startRound() {
    this.owner.fill(0);
    this.stamp.fill(0);
    this.segs = [];
    this.t = 0;
    this.over = false;
    this.round++;
    if (this.round > 1) {
      this.layout = randomLayout();
      this.walls = buildWalls(this.layout);
    }
    this.causes = this.tractors.map(() => null);
    for (const tr of this.tractors) Object.assign(tr, { alive: true, turn: 0, think: 0, trail: false });
    this.spawn();
  }

  speedMul() {
    return this.t < RUSH_AT ? 1 : Math.min(1.7, 1 + (this.t - RUSH_AT) * 0.025);
  }

  setTurn(id: number, turn: Turn) {
    this.tractors[id].turn = turn;
  }

  /** 0 — свободно, 255 — стена, иначе номер трактора + 1 */
  private cell(x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 255;
    const i = (y | 0) * W + (x | 0);
    return this.walls[i] ? 255 : this.owner[i];
  }

  private causeAt(x: number, y: number, tr: Tractor): Cause | null {
    if (x < 0 || y < 0 || x >= W || y >= H) return { k: 'border' };
    const i = (y | 0) * W + (x | 0);
    const w = this.walls[i];
    if (w === WALL_BORDER) return { k: 'border' };
    if (w === WALL_RIVER) return { k: 'river' };
    if (w >= WALL_PLACE) return { k: 'place', place: w - WALL_PLACE };
    const o = this.owner[i];
    if (!o) return null;
    if (o !== tr.id + 1) return { k: 'trail', owner: o - 1 };
    return this.t - this.stamp[i] > GRACE ? { k: 'own' } : null;
  }

  private hits(tr: Tractor): Cause | null {
    const c = Math.cos(tr.a), s = Math.sin(tr.a);
    const pts: [number, number][] = [
      [tr.x + c * HIT_R, tr.y + s * HIT_R],
      [tr.x + c * HIT_R * 0.8 - s * 1.1, tr.y + s * HIT_R * 0.8 + c * 1.1],
      [tr.x + c * HIT_R * 0.8 + s * 1.1, tr.y + s * HIT_R * 0.8 - c * 1.1]
    ];
    for (const [x, y] of pts) {
      const c = this.causeAt(x, y, tr);
      if (c) return c;
    }
    return null;
  }

  private stampLine(id: number, x0: number, y0: number, x1: number, y1: number) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let k = 1; k <= n; k++) {
      const cx = x0 + ((x1 - x0) * k) / n, cy = y0 + ((y1 - y0) * k) / n;
      for (let j = Math.floor(cy - STAMP_R); j <= Math.floor(cy + STAMP_R); j++) {
        if (j < 0 || j >= H) continue;
        for (let i = Math.floor(cx - STAMP_R); i <= Math.floor(cx + STAMP_R); i++) {
          if (i < 0 || i >= W) continue;
          if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 > STAMP_R * STAMP_R) continue;
          const idx = j * W + i;
          if (!this.owner[idx]) {
            this.owner[idx] = id + 1;
            this.stamp[idx] = this.t;
          }
        }
      }
    }
  }

  step(dt: number): SimEvent[] {
    if (this.over) return [];
    const ev: SimEvent[] = [];
    this.t += dt;
    const m = this.speedMul();
    const v = SPEED * m, tr = TURN_RATE * m; // разгоняемся вместе с поворотом: радиус разворота тот же
    const alive = this.tractors.filter((t) => t.alive);

    for (const b of alive) if (b.bot && this.t >= b.think) this.decide(b, v, tr);

    for (const t of alive) {
      t.a += t.turn * tr * dt;
      t.x += Math.cos(t.a) * v * dt;
      t.y += Math.sin(t.a) * v * dt;
    }

    // Сначала проверяем всех, потом прокладываем борозды: кто врезался одновременно — выбыли оба
    const dead = new Map<number, Cause>();
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        if (Math.hypot(alive[i].x - alive[j].x, alive[i].y - alive[j].y) < HIT_R * 1.7) {
          dead.set(alive[i].id, { k: 'tractor', other: alive[j].id });
          dead.set(alive[j].id, { k: 'tractor', other: alive[i].id });
        }
      }
    }
    for (const t of alive) {
      if (dead.has(t.id)) continue;
      const c = this.hits(t);
      if (c) dead.set(t.id, c);
    }

    if (this.t >= TRAIL_DELAY) {
      for (const t of alive) {
        if (!t.trail) {
          t.trail = true;
        } else {
          this.stampLine(t.id, t.lx, t.ly, t.x, t.y);
          this.segs.push({ id: t.id, x0: t.lx, y0: t.ly, x1: t.x, y1: t.y });
        }
        t.lx = t.x;
        t.ly = t.y;
      }
    }

    for (const [id, cause] of dead) {
      this.tractors[id].alive = false;
      this.causes[id] = cause;
      ev.push({ type: 'crash', id, cause });
    }

    const left = this.tractors.filter((t) => t.alive);
    if (left.length <= 1) {
      this.over = true;
      const winner = left.length === 1 ? left[0].id : -1;
      if (winner >= 0) this.tractors[winner].score++;
      ev.push({ type: 'roundEnd', winner });
    }
    return ev;
  }

  // ---------- Бот ----------

  /** Сколько можно проехать по плану «повернуть на dur секунд, дальше прямо», пока не упрёшься */
  private probe(x: number, y: number, a: number, turn: number, dur: number, max: number, v: number, tr: number, self?: Tractor) {
    const step = 1.5;
    let d = 0, time = 0, mx = x, my = y;
    // Соседи: считаем, что едут прямо, и не лезем туда, где они будут в то же время
    const others = self ? this.tractors.filter((o) => o !== self && o.alive) : [];
    while (d < max) {
      if (time < dur) a += turn * tr * (step / v);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      d += step;
      time += step / v;
      const c = Math.cos(a), s = Math.sin(a);
      if (this.cell(x, y) || this.cell(x - s * 1.4, y + c * 1.4) || this.cell(x + s * 1.4, y - c * 1.4)) return { free: d, mx, my };
      if (time < 1.2) {
        for (const o of others) {
          const ox = o.x + Math.cos(o.a) * v * time, oy = o.y + Math.sin(o.a) * v * time;
          if ((ox - x) ** 2 + (oy - y) ** 2 < 49) return { free: d, mx, my };
        }
      }
      if (d <= 16) { mx = x; my = y; }
    }
    return { free: max, mx, my };
  }

  /** Доля свободных точек на двух кольцах вокруг (0..1) */
  private space(x: number, y: number) {
    let free = 0;
    for (const r of [12, 26]) {
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        if (!this.cell(x + Math.cos(a) * r, y + Math.sin(a) * r)) free++;
      }
    }
    return free / 24;
  }

  private decide(b: Tractor, v: number, tr: number) {
    const skill = b.skill;
    b.think = this.t + 0.06 + (1 - skill) * 0.14 + Math.random() * 0.04;
    if (Math.random() < (1 - skill) * 0.12) return; // зазевался: едет как ехал
    const look = 34 + skill * 50;
    const plans: [Turn, number][] = [[-1, 9], [-1, 0.35], [0, 0], [1, 0.35], [1, 9]];
    let best = -Infinity;
    let pick: Turn = 0;
    for (const [turn, dur] of plans) {
      const r = this.probe(b.x, b.y, b.a, turn, dur, look, v, tr, b);
      let score = r.free + (turn === 0 ? 2 : 0) + (turn === b.turn ? 1.5 : 0) + Math.random() * (1 - skill) * 6;
      // Не лезть в тупик: сколько свободно вокруг точки впереди
      score += this.space(r.mx, r.my) * skill * 14;
      // Подрезать: выйти чуть впереди соперника, но только когда впереди совсем свободно
      if (r.free >= look) {
        let bonus = 0;
        for (const o of this.tractors) {
          if (o === b || !o.alive) continue;
          const tx = o.x + Math.cos(o.a) * 24, ty = o.y + Math.sin(o.a) * 24;
          const dist = Math.hypot(r.mx - tx, r.my - ty);
          bonus = Math.max(bonus, Math.max(0, 22 - dist) * (o.bot ? 0.25 : 0.4));
        }
        score += skill * bonus;
      }
      if (score > best) {
        best = score;
        pick = turn;
      }
    }
    b.turn = pick;
  }

  // ---------- Расстановка ----------

  private spawn() {
    const placed: Tractor[] = [];
    const order = [...this.tractors];
    for (const t of order) {
      let ok = false;
      for (let tries = 0; tries < 800 && !ok; tries++) {
        const minGap = tries < 400 ? 55 : 35;
        const x = 18 + Math.random() * (W - 36);
        const y = 18 + Math.random() * (H - 36);
        const a = Math.random() * Math.PI * 2;
        let clear = !this.cell(x, y);
        for (let k = 0; k < 10 && clear; k++) {
          const ang = (k * Math.PI) / 5;
          if (this.cell(x + Math.cos(ang) * 12, y + Math.sin(ang) * 12)) clear = false;
        }
        if (!clear) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < minGap)) continue;
        if (this.probe(x, y, a, 0, 0, 70, SPEED, TURN_RATE).free < 70) continue;
        // Не смотреть прямо на соседа: лобовое на старте — нечестно
        if (placed.some((p) => {
          const dx = p.x - x, dy = p.y - y;
          const along = dx * Math.cos(a) + dy * Math.sin(a);
          const across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
          return along > 0 && along < 90 && across < 14;
        })) continue;
        Object.assign(t, { x, y, a, lx: x, ly: y });
        ok = true;
      }
      if (!ok) Object.assign(t, { x: W / 2, y: H / 2 + 40 * (placed.length - 1.5), a: 0, lx: W / 2, ly: H / 2 });
      placed.push(t);
    }
  }
}
