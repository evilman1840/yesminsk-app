/**
 * «Минский час пик»: карта. Поле — схема Минска сверху, по краю МКАД.
 * Препятствия — узнаваемые места: стела, «Алмаз» библиотеки, Красный костёл, Комаровка, Ворота Минска и Свислочь.
 * Каждый раунд места встают по-новому (randomLayout), а Свислочь срезает один из четырёх углов.
 *
 * Правило: всё, что нарисовано у здания, твёрдое. Каждое место описано набором фигур (shapes),
 * и рисунок не выходит за них, чтобы игрок не врезался «в пустоту» и не проезжал «сквозь шпиль».
 * Под зданием — тень: так видно, что оно «стоит», а не нарисовано на асфальте.
 * Подписи и бледные улицы с парками — только картинка, по ним ездить можно.
 */

export const W = 200;
export const H = 280;
export const BORDER = 3; // ширина МКАДа: за ней — вылет

// Что в клетке стены: МКАД, река или место (WALL_PLACE + номер в PLACES)
export const WALL_BORDER = 1;
export const WALL_RIVER = 2;
export const WALL_PLACE = 10;

type Pt = [number, number];
type Shape =
  | { k: 'circle'; x: number; y: number; r: number }
  | { k: 'poly'; p: Pt[] }
  | { k: 'seg'; ax: number; ay: number; bx: number; by: number; r: number };

const rect = (x0: number, y0: number, x1: number, y1: number): Shape => ({ k: 'poly', p: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
const ngon = (cx: number, cy: number, r: number, n: number, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + (i * 2 * Math.PI) / n), cy + r * Math.sin(rot + (i * 2 * Math.PI) / n)] as Pt);
// Верхняя половина эллипса (купол) с основанием по y = cy
const dome = (cx: number, cy: number, rx: number, ry: number): Pt[] =>
  Array.from({ length: 17 }, (_, i) => {
    const t = Math.PI + (i * Math.PI) / 16;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as Pt;
  });
const spire = (x0: number, x1: number, y: number, h: number): Pt[] => [[x0, y], [x1, y], [(x0 + x1) / 2, y - h]];
const move = (s: Shape, dx: number, dy: number): Shape =>
  s.k === 'circle'
    ? { ...s, x: s.x + dx, y: s.y + dy }
    : s.k === 'poly'
      ? { k: 'poly', p: s.p.map(([x, y]) => [x + dx, y + dy] as Pt) }
      : { ...s, ax: s.ax + dx, ay: s.ay + dy, bx: s.bx + dx, by: s.by + dy };

export type MapPalette = {
  paper: string;
  card: string;
  cardElevated: string;
  border: string;
  ink: string;
  inkMuted: string;
  terracotta: string;
  mustard: string;
  sage: string;
  sky: string;
  dark: boolean;
};

type Place = {
  id: string;
  r: number; // радиус описанного круга: для расстановки
  labelY: number;
  label: string;
  shapes: Shape[]; // относительно центра места
  draw: (ctx: CanvasRenderingContext2D, c: MapPalette) => void; // ctx уже сдвинут в центр места
};

const path = (ctx: CanvasRenderingContext2D, p: Pt[]) => {
  ctx.beginPath();
  p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
};

// ---------- Места (координаты — от центра места) ----------

// Стела «Минск — город-герой»: круглая площадь, игла и звезда
const stelaNeedle: Pt[] = [[-2.6, 12], [2.6, 12], [1.1, -15], [-1.1, -15]];
const STELA: Place = {
  id: 'stela',
  r: 21,
  labelY: 26,
  label: 'Стела',
  shapes: [{ k: 'circle', x: 0, y: 12, r: 9 }, { k: 'poly', p: stelaNeedle }, { k: 'circle', x: 0, y: -17, r: 2.8 }],
  draw(ctx, c) {
    ctx.fillStyle = c.card;
    ctx.beginPath();
    ctx.arc(0, 12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.sage;
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 5.6, 12 + Math.sin(a) * 5.6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = c.cardElevated;
    path(ctx, stelaNeedle);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.mustard;
    path(ctx, ngon(0, -17, 2.8, 5, -Math.PI / 2).flatMap((p, i, arr) => {
      const q = arr[(i + 1) % arr.length];
      const a = Math.atan2((p[1] + q[1]) / 2 + 17, (p[0] + q[0]) / 2);
      return [p, [Math.cos(a) * 1.15, -17 + Math.sin(a) * 1.15] as Pt];
    }));
    ctx.fill();
    ctx.stroke();
  }
};

// Национальная библиотека, «Алмаз»: восьмиугольник с гранями на подставке
const almazOct = ngon(0, -2, 14, 8, Math.PI / 8);
const almazStand: Pt[] = [[-4, 10.5], [4, 10.5], [6, 16], [-6, 16]];
const ALMAZ: Place = {
  id: 'almaz',
  r: 17,
  labelY: 22,
  label: 'Библиотека',
  shapes: [{ k: 'poly', p: almazOct }, { k: 'poly', p: almazStand }],
  draw(ctx, c) {
    ctx.fillStyle = c.cardElevated;
    path(ctx, almazStand);
    ctx.fill();
    ctx.stroke();
    const glass = ctx.createLinearGradient(-14, -16, 14, 12);
    glass.addColorStop(0, c.sky);
    glass.addColorStop(1, c.dark ? '#24435e' : '#9cc0dc');
    ctx.fillStyle = glass;
    path(ctx, almazOct);
    ctx.fill();
    ctx.stroke();
    const s = 5.6;
    const sq: Pt[] = [[-s, -2 - s], [s, -2 - s], [s, -2 + s], [-s, -2 + s]];
    ctx.save();
    ctx.strokeStyle = c.dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.6;
    path(ctx, sq);
    ctx.stroke();
    ctx.beginPath();
    almazOct.forEach(([x, y]) => {
      const near = sq.reduce((b, q) => ((q[0] - x) ** 2 + (q[1] - y) ** 2 < (b[0] - x) ** 2 + (b[1] - y) ** 2 ? q : b));
      ctx.moveTo(x, y);
      ctx.lineTo(...near);
    });
    ctx.moveTo(-s, -2); ctx.lineTo(s, -2);
    ctx.moveTo(0, -2 - s); ctx.lineTo(0, -2 + s);
    ctx.stroke();
    ctx.restore();
  }
};

// Красный костёл: корпус, высокая башня по центру и две малые
const K = {
  body: [-10, 4, 10, 22] as const,
  towerL: [-13, -2, -8, 22] as const,
  towerR: [8, -2, 13, 22] as const,
  towerC: [-3, -14, 3, 4] as const
};
const KOSTEL: Place = {
  id: 'kostel',
  r: 25,
  labelY: 28,
  label: 'Красный костёл',
  shapes: [
    rect(...K.body), rect(...K.towerL), rect(...K.towerR), rect(...K.towerC),
    { k: 'poly', p: spire(K.towerL[0], K.towerL[2], K.towerL[1], 6) },
    { k: 'poly', p: spire(K.towerR[0], K.towerR[2], K.towerR[1], 6) },
    { k: 'poly', p: spire(K.towerC[0], K.towerC[2], K.towerC[1], 9) }
  ],
  draw(ctx, c) {
    const brick = c.dark ? '#c4573f' : '#b5442e';
    ctx.fillStyle = brick;
    for (const r of [K.towerL, K.towerR, K.body, K.towerC]) {
      ctx.beginPath();
      ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      ctx.fill();
      ctx.stroke();
    }
    for (const [r, h] of [[K.towerL, 6], [K.towerR, 6], [K.towerC, 9]] as const) {
      path(ctx, spire(r[0], r[2], r[1], h));
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = c.cardElevated;
    ctx.beginPath();
    ctx.arc(0, 11, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.moveTo(-2, 22);
    ctx.lineTo(-2, 18.5);
    ctx.arc(0, 18.5, 2, Math.PI, 0);
    ctx.lineTo(2, 22);
    ctx.fill();
    ctx.fillRect(-11.1, 2, 1.2, 3);
    ctx.fillRect(9.9, 2, 1.2, 3);
    ctx.fillRect(-0.6, -9, 1.2, 3);
  }
};

// Комаровский рынок: ребристый купол на основании
const KOMAR: Place = {
  id: 'komar',
  r: 19,
  labelY: 17,
  label: 'Комаровка',
  shapes: [{ k: 'poly', p: dome(0, 4, 15, 11) }, rect(-16, 4, 16, 11)],
  draw(ctx, c) {
    ctx.fillStyle = c.cardElevated;
    ctx.beginPath();
    ctx.rect(-16, 4, 32, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.mustard;
    path(ctx, dome(0, 4, 15, 11));
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let k = 1; k < 4; k++) ctx.ellipse(0, 4, (15 * k) / 4, 11, 0, Math.PI, Math.PI * 2);
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = c.ink;
    for (let x = -12; x <= 12; x += 6) ctx.fillRect(x - 1, 5.5, 2, 4);
  }
};

// Ворота Минска: две башни у вокзала, между ними можно проехать
const GW = 14, GY0 = -10, GY1 = 14;
const gateTower = (x: number): Shape[] => [
  rect(x, GY0, x + GW, GY1),
  rect(x + 2, GY0 - 5, x + GW - 2, GY0),
  rect(x + 4.5, GY0 - 9, x + GW - 4.5, GY0 - 5)
];
const GATES: Place = {
  id: 'gates',
  r: 27,
  labelY: 20,
  label: 'Ворота Минска',
  shapes: [...gateTower(-22), ...gateTower(8)],
  draw(ctx, c) {
    for (const x0 of [-22, 8]) {
      ctx.fillStyle = c.cardElevated;
      for (const sh of gateTower(x0)) {
        if (sh.k !== 'poly') continue;
        path(ctx, sh.p);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = c.inkMuted;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) ctx.fillRect(x0 + 2.5 + col * 3.6, GY0 + 9 + row * 4.6, 1.6, 2.4);
      }
      ctx.fillStyle = c.ink;
      for (const dx of [3, GW - 3]) {
        ctx.beginPath();
        ctx.arc(x0 + dx, GY0 - 5.8, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // часы на левой башне, герб на правой
    const cx = -22 + GW / 2;
    ctx.fillStyle = c.paper;
    ctx.beginPath();
    ctx.arc(cx, GY0 + 4.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, GY0 + 4.5); ctx.lineTo(cx, GY0 + 2.6);
    ctx.moveTo(cx, GY0 + 4.5); ctx.lineTo(cx + 1.4, GY0 + 4.5);
    ctx.stroke();
    ctx.fillStyle = c.sky;
    const gx = 8 + GW / 2, gy = GY0 + 2.4;
    path(ctx, [[gx - 2, gy], [gx + 2, gy], [gx + 2, gy + 2.6], [gx, gy + 4.2], [gx - 2, gy + 2.6]]);
    ctx.fill();
    ctx.stroke();
  }
};

export const PLACES: Place[] = [GATES, KOSTEL, STELA, KOMAR, ALMAZ];

// ---------- Свислочь: срезает угол, через неё — мост ----------

const RIVER_BASE: Pt[] = [[-6, 78], [14, 71], [30, 61], [42, 49], [52, 37], [60, 23], [64, 9], [66, -6]];
export const RIVER_HALF = 5.5;
const BRIDGE_BASE: Pt[] = (() => {
  const x = 36, y = 55, ux = Math.SQRT1_2, uy = -Math.SQRT1_2, half = 5.5, len = 9;
  const nx = -uy, ny = ux; // поперёк реки
  return [
    [x - ux * half - nx * len, y - uy * half - ny * len],
    [x + ux * half - nx * len, y + uy * half - ny * len],
    [x + ux * half + nx * len, y + uy * half + ny * len],
    [x - ux * half + nx * len, y - uy * half + ny * len]
  ];
})();

// ---------- Расстановка ----------

export type Layout = {
  corner: number; // угол реки: бит 1 — справа, бит 2 — снизу
  places: { i: number; x: number; y: number }[];
};

const flip = (corner: number) => ([x, y]: Pt): Pt => [corner & 1 ? W - x : x, corner & 2 ? H - y : y];
const riverOf = (corner: number) => RIVER_BASE.map(flip(corner));
const bridgeOf = (corner: number) => BRIDGE_BASE.map(flip(corner));

function distToPolyline(x: number, y: number, p: Pt[]) {
  let best = Infinity;
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

// Как в первой версии: если случайная расстановка не сложилась
const FALLBACK: Layout = { corner: 0, places: [{ i: 0, x: 100, y: 242 }, { i: 1, x: 98, y: 146 }, { i: 2, x: 44, y: 118 }, { i: 3, x: 160, y: 190 }, { i: 4, x: 150, y: 72 }] };

export function randomLayout(): Layout {
  const GAP = 20; // между местами проезжает трактор
  for (let attempt = 0; attempt < 60; attempt++) {
    const corner = Math.floor(Math.random() * 4);
    const river = riverOf(corner);
    const placed: Layout['places'] = [];
    for (let i = 0; i < PLACES.length; i++) {
      const p = PLACES[i];
      for (let tries = 0; tries < 200; tries++) {
        const x = p.r + 10 + Math.random() * (W - 2 * p.r - 20);
        const y = p.r + 10 + Math.random() * (H - 2 * p.r - 20);
        if (distToPolyline(x, y, river) < p.r + RIVER_HALF + 10) continue;
        if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < PLACES[q.i].r + p.r + GAP)) continue;
        placed.push({ i, x, y });
        break;
      }
    }
    if (placed.length === PLACES.length) return { corner, places: placed };
  }
  return FALLBACK;
}

// ---------- Где твёрдо ----------

function inPoly(x: number, y: number, p: Pt[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inShape(x: number, y: number, s: Shape) {
  if (s.k === 'circle') return (x - s.x) ** 2 + (y - s.y) ** 2 <= s.r * s.r;
  if (s.k === 'poly') return inPoly(x, y, s.p);
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy)));
  return (x - s.ax - t * dx) ** 2 + (y - s.ay - t * dy) ** 2 <= s.r * s.r;
}

/** Клетки 1×1: 0 — можно ехать, иначе что там (WALL_BORDER, WALL_RIVER, WALL_PLACE + номер места) */
export function buildWalls(layout: Layout): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = i + 0.5, y = j + 0.5;
      if (x < BORDER || y < BORDER || x > W - BORDER || y > H - BORDER) g[j * W + i] = WALL_BORDER;
    }
  }
  // Места: проверяем только клетки в их круге
  for (const { i: pi, x: cx, y: cy } of layout.places) {
    const p = PLACES[pi];
    const shapes = p.shapes.map((s) => move(s, cx, cy));
    for (let j = Math.max(0, Math.floor(cy - p.r - 1)); j < Math.min(H, cy + p.r + 1); j++) {
      for (let i = Math.max(0, Math.floor(cx - p.r - 1)); i < Math.min(W, cx + p.r + 1); i++) {
        if (g[j * W + i]) continue;
        if (shapes.some((s) => inShape(i + 0.5, j + 0.5, s))) g[j * W + i] = WALL_PLACE + pi;
      }
    }
  }
  // Река, кроме моста
  const river = riverOf(layout.corner), bridge = bridgeOf(layout.corner);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (g[j * W + i]) continue;
      const x = i + 0.5, y = j + 0.5;
      if (distToPolyline(x, y, river) <= RIVER_HALF && !inPoly(x, y, bridge)) g[j * W + i] = WALL_RIVER;
    }
  }
  return g;
}

// ---------- Рисунок ----------

const label = (ctx: CanvasRenderingContext2D, c: MapPalette, text: string, x: number, y: number) => {
  ctx.font = '600 5.5px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = c.paper;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = c.inkMuted;
  ctx.fillText(text, x, y);
};

const fillShape = (ctx: CanvasRenderingContext2D, s: Shape) => {
  ctx.beginPath();
  if (s.k === 'circle') ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  else if (s.k === 'poly') s.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.fill();
};

/** Рисует карту в мировых координатах (ctx уже масштабирован под W×H) */
export function drawMap(ctx: CanvasRenderingContext2D, c: MapPalette, layout: Layout) {
  const line = 0.7;
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, W, H);

  // Бледные проспекты и парки: только фон
  ctx.save();
  ctx.globalAlpha = c.dark ? 0.06 : 0.05;
  ctx.strokeStyle = c.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(10, 268); ctx.lineTo(196, 30); // проспект Независимости
  ctx.moveTo(4, 196); ctx.lineTo(196, 150);
  ctx.moveTo(126, 4); ctx.lineTo(124, 276);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 30; x < W; x += 34) { ctx.moveTo(x, 4); ctx.lineTo(x - 12, 276); }
  for (let y = 30; y < H; y += 40) { ctx.moveTo(4, y); ctx.lineTo(196, y + 10); }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = c.dark ? 0.14 : 0.12;
  ctx.fillStyle = c.sage;
  for (const [x, y, r] of [[22, 205, 16], [182, 122, 13], [74, 98, 9], [178, 252, 11]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Свислочь
  const f = flip(layout.corner);
  const river = riverOf(layout.corner), bridge = bridgeOf(layout.corner);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = c.sky;
  ctx.globalAlpha = c.dark ? 0.6 : 0.45;
  ctx.lineWidth = RIVER_HALF * 2;
  ctx.beginPath();
  river.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = c.paper;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Остров слёз
  const [ix, iy] = f([61.5, 17]);
  ctx.fillStyle = c.sage;
  ctx.beginPath();
  ctx.ellipse(ix, iy, 2.6, 1.8, (layout.corner === 1 || layout.corner === 2 ? -1 : 1) * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.cardElevated;
  ctx.beginPath();
  ctx.arc(ix, iy - 0.4, 0.8, 0, Math.PI * 2);
  ctx.fill();
  // Мост
  ctx.fillStyle = c.card;
  path(ctx, bridge);
  ctx.fill();
  ctx.strokeStyle = c.inkMuted;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.moveTo(...bridge[0]); ctx.lineTo(...bridge[3]);
  ctx.moveTo(...bridge[1]); ctx.lineTo(...bridge[2]);
  ctx.stroke();
  ctx.save();
  const [lx, ly] = f([20, 36]);
  ctx.translate(lx, ly);
  ctx.rotate(layout.corner === 1 || layout.corner === 2 ? 0.65 : -0.65);
  ctx.font = 'italic 600 6px "Lora", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = c.sky;
  ctx.fillText('Свислочь', 0, 0);
  ctx.restore();

  // Места: сначала тени (видно, что здание стоит и в него не проехать), потом сами здания
  ctx.save();
  ctx.fillStyle = c.dark ? 'rgba(0,0,0,0.45)' : 'rgba(43,38,35,0.2)';
  for (const { i, x, y } of layout.places) {
    for (const s of PLACES[i].shapes) fillShape(ctx, move(s, x + 1.4, y + 2));
  }
  ctx.restore();
  for (const { i, x, y } of layout.places) {
    const p = PLACES[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineWidth = line;
    ctx.strokeStyle = c.ink;
    p.draw(ctx, c);
    ctx.restore();
    label(ctx, c, p.label, x, y + p.labelY);
  }

  // МКАД по краю
  ctx.fillStyle = c.ink;
  ctx.globalAlpha = c.dark ? 0.75 : 0.85;
  ctx.fillRect(0, 0, W, BORDER);
  ctx.fillRect(0, H - BORDER, W, BORDER);
  ctx.fillRect(0, 0, BORDER, H);
  ctx.fillRect(W - BORDER, 0, BORDER, H);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.mustard;
  ctx.lineWidth = 0.4;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(BORDER / 2, BORDER / 2, W - BORDER, H - BORDER);
  ctx.setLineDash([]);
  ctx.font = '700 2.4px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = c.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('МКАД', W / 2, H - BORDER / 2);
  ctx.fillText('МКАД', W / 2, BORDER / 2);
}
