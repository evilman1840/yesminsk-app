/**
 * «Минский час пик»: карта. Поле — схема Минска сверху, по краю МКАД.
 * Препятствия — узнаваемые места: стела, «Алмаз» библиотеки, Красный костёл, Комаровка, Ворота Минска и Свислочь.
 *
 * Правило: всё, что нарисовано у здания, твёрдое. Каждое место описано набором фигур (FOOTPRINTS),
 * и рисунок не выходит за них, чтобы игрок не врезался «в пустоту» и не проезжал «сквозь шпиль».
 * Подписи и бледные улицы с парками — только картинка, по ним ездить можно.
 */

export const W = 200;
export const H = 280;
export const BORDER = 3; // ширина МКАДа: за ней — вылет

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

// ---------- Места ----------

// Стела «Минск — город-герой»: круглая площадь, игла и звезда
const STELA = { x: 44, y: 130 };
const stelaNeedle: Pt[] = [[STELA.x - 2.6, STELA.y], [STELA.x + 2.6, STELA.y], [STELA.x + 1.1, STELA.y - 27], [STELA.x - 1.1, STELA.y - 27]];

// Национальная библиотека, «Алмаз»: восьмиугольник с гранями на подставке
const ALMAZ = { x: 150, y: 70, r: 14 };
const almazOct = ngon(ALMAZ.x, ALMAZ.y, ALMAZ.r, 8, Math.PI / 8);
const almazStand: Pt[] = [[ALMAZ.x - 4, ALMAZ.y + 12.5], [ALMAZ.x + 4, ALMAZ.y + 12.5], [ALMAZ.x + 6, ALMAZ.y + 18], [ALMAZ.x - 6, ALMAZ.y + 18]];

// Красный костёл: корпус, высокая башня по центру и две малые
const KOSTEL = { x: 98, y: 168 }; // низ фасада
const kostel = {
  body: [KOSTEL.x - 10, KOSTEL.y - 18, KOSTEL.x + 10, KOSTEL.y] as const,
  towerL: [KOSTEL.x - 13, KOSTEL.y - 24, KOSTEL.x - 8, KOSTEL.y] as const,
  towerR: [KOSTEL.x + 8, KOSTEL.y - 24, KOSTEL.x + 13, KOSTEL.y] as const,
  towerC: [KOSTEL.x - 3, KOSTEL.y - 36, KOSTEL.x + 3, KOSTEL.y - 18] as const
};
const spire = (x0: number, x1: number, y: number, h: number): Pt[] => [[x0, y], [x1, y], [(x0 + x1) / 2, y - h]];

// Комаровский рынок: ребристый купол на основании
const KOMAR = { x: 160, y: 198, rx: 15, ry: 11 };

// Ворота Минска: две башни у вокзала, между ними можно проехать
const GATES = { y0: 232, y1: 256, l: 78, r: 108, w: 14 };
const gateTower = (x: number): Shape[] => [
  rect(x, GATES.y0, x + GATES.w, GATES.y1),
  rect(x + 2, GATES.y0 - 5, x + GATES.w - 2, GATES.y0),
  rect(x + 4.5, GATES.y0 - 9, x + GATES.w - 4.5, GATES.y0 - 5)
];

// Свислочь: срезает верхний левый угол, через неё — мост
export const RIVER: Pt[] = [[-6, 78], [14, 71], [30, 61], [42, 49], [52, 37], [60, 23], [64, 9], [66, -6]];
export const RIVER_HALF = 5.5;
const BRIDGE = { x: 36, y: 55, ux: Math.SQRT1_2, uy: -Math.SQRT1_2, half: 5.5, len: 9 };
const bridgePoly: Pt[] = (() => {
  const { x, y, ux, uy, half, len } = BRIDGE;
  const nx = -uy, ny = ux; // поперёк реки
  return [
    [x - ux * half - nx * len, y - uy * half - ny * len],
    [x + ux * half - nx * len, y + uy * half - ny * len],
    [x + ux * half + nx * len, y + uy * half + ny * len],
    [x - ux * half + nx * len, y - uy * half + ny * len]
  ];
})();

const FOOTPRINTS: Shape[] = [
  { k: 'circle', x: STELA.x, y: STELA.y, r: 9 },
  { k: 'poly', p: stelaNeedle },
  { k: 'circle', x: STELA.x, y: STELA.y - 29, r: 2.8 },
  { k: 'poly', p: almazOct },
  { k: 'poly', p: almazStand },
  rect(...kostel.body),
  rect(...kostel.towerL),
  rect(...kostel.towerR),
  rect(...kostel.towerC),
  { k: 'poly', p: spire(kostel.towerL[0], kostel.towerL[2], kostel.towerL[1], 6) },
  { k: 'poly', p: spire(kostel.towerR[0], kostel.towerR[2], kostel.towerR[1], 6) },
  { k: 'poly', p: spire(kostel.towerC[0], kostel.towerC[2], kostel.towerC[1], 9) },
  { k: 'poly', p: dome(KOMAR.x, KOMAR.y - 4, KOMAR.rx, KOMAR.ry) },
  rect(KOMAR.x - KOMAR.rx - 1, KOMAR.y - 4, KOMAR.x + KOMAR.rx + 1, KOMAR.y + 3),
  ...gateTower(GATES.l),
  ...gateTower(GATES.r),
  ...RIVER.slice(1).map(([bx, by], i): Shape => ({ k: 'seg', ax: RIVER[i][0], ay: RIVER[i][1], bx, by, r: RIVER_HALF }))
];

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

/** Клетки 1×1: 1 — стена (МКАД, здание, река), 0 — можно ехать */
export function buildWalls(): Uint8Array {
  const g = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = i + 0.5, y = j + 0.5;
      if (x < BORDER || y < BORDER || x > W - BORDER || y > H - BORDER) {
        g[j * W + i] = 1;
        continue;
      }
      if (inPoly(x, y, bridgePoly)) continue;
      for (const s of FOOTPRINTS) {
        if (inShape(x, y, s)) {
          g[j * W + i] = 1;
          break;
        }
      }
    }
  }
  return g;
}

// ---------- Рисунок ----------

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

const path = (ctx: CanvasRenderingContext2D, p: Pt[]) => {
  ctx.beginPath();
  p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
};

const label = (ctx: CanvasRenderingContext2D, c: MapPalette, text: string, x: number, y: number) => {
  ctx.font = '600 6px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = c.paper;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = c.inkMuted;
  ctx.fillText(text, x, y);
};

/** Рисует карту в мировых координатах (ctx уже масштабирован под W×H) */
export function drawMap(ctx: CanvasRenderingContext2D, c: MapPalette) {
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
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = c.sky;
  ctx.globalAlpha = c.dark ? 0.55 : 0.4;
  ctx.lineWidth = RIVER_HALF * 2;
  ctx.beginPath();
  RIVER.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = c.paper;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Остров слёз
  ctx.fillStyle = c.sage;
  ctx.beginPath();
  ctx.ellipse(61.5, 17, 2.6, 1.8, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.cardElevated;
  ctx.beginPath();
  ctx.arc(61.5, 16.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
  // Мост
  ctx.fillStyle = c.card;
  path(ctx, bridgePoly);
  ctx.fill();
  ctx.strokeStyle = c.inkMuted;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.moveTo(...bridgePoly[0]); ctx.lineTo(...bridgePoly[3]);
  ctx.moveTo(...bridgePoly[1]); ctx.lineTo(...bridgePoly[2]);
  ctx.stroke();
  ctx.save();
  ctx.translate(20, 36);
  ctx.rotate(-0.65);
  ctx.font = 'italic 600 6px "Lora", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = c.sky;
  ctx.fillText('Свислочь', 0, 0);
  ctx.restore();

  ctx.lineJoin = 'round';
  ctx.lineWidth = line;
  ctx.strokeStyle = c.ink;

  // Стела
  ctx.fillStyle = c.card;
  ctx.beginPath();
  ctx.arc(STELA.x, STELA.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.sage;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(STELA.x + Math.cos(a) * 5.6, STELA.y + Math.sin(a) * 5.6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = c.cardElevated;
  path(ctx, stelaNeedle);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.mustard;
  path(ctx, ngon(STELA.x, STELA.y - 29, 2.8, 5, -Math.PI / 2).flatMap((p, i, arr) => {
    const q = arr[(i + 1) % arr.length];
    const a = Math.atan2((p[1] + q[1]) / 2 - (STELA.y - 29), (p[0] + q[0]) / 2 - STELA.x);
    return [p, [STELA.x + Math.cos(a) * 1.15, STELA.y - 29 + Math.sin(a) * 1.15] as Pt];
  }));
  ctx.fill();
  ctx.stroke();
  label(ctx, c, 'Стела', STELA.x, STELA.y + 14);

  // «Алмаз»
  ctx.fillStyle = c.cardElevated;
  path(ctx, almazStand);
  ctx.fill();
  ctx.stroke();
  const glass = ctx.createLinearGradient(ALMAZ.x - 14, ALMAZ.y - 14, ALMAZ.x + 14, ALMAZ.y + 14);
  glass.addColorStop(0, c.sky);
  glass.addColorStop(1, c.dark ? '#24435e' : '#9cc0dc');
  ctx.fillStyle = glass;
  path(ctx, almazOct);
  ctx.fill();
  ctx.stroke();
  const s = 5.6;
  const sq: Pt[] = [[ALMAZ.x - s, ALMAZ.y - s], [ALMAZ.x + s, ALMAZ.y - s], [ALMAZ.x + s, ALMAZ.y + s], [ALMAZ.x - s, ALMAZ.y + s]];
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
  ctx.moveTo(ALMAZ.x - s, ALMAZ.y); ctx.lineTo(ALMAZ.x + s, ALMAZ.y);
  ctx.moveTo(ALMAZ.x, ALMAZ.y - s); ctx.lineTo(ALMAZ.x, ALMAZ.y + s);
  ctx.stroke();
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = line;
  label(ctx, c, 'Библиотека', ALMAZ.x, ALMAZ.y + 23);

  // Красный костёл
  const brick = c.dark ? '#c4573f' : '#b5442e';
  ctx.fillStyle = brick;
  for (const r of [kostel.towerL, kostel.towerR, kostel.body, kostel.towerC]) {
    ctx.beginPath();
    ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    ctx.fill();
    ctx.stroke();
  }
  for (const [r, h] of [[kostel.towerL, 6], [kostel.towerR, 6], [kostel.towerC, 9]] as const) {
    path(ctx, spire(r[0], r[2], r[1], h));
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = c.cardElevated;
  ctx.beginPath();
  ctx.arc(KOSTEL.x, KOSTEL.y - 11, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.moveTo(KOSTEL.x - 2, KOSTEL.y);
  ctx.lineTo(KOSTEL.x - 2, KOSTEL.y - 3.5);
  ctx.arc(KOSTEL.x, KOSTEL.y - 3.5, 2, Math.PI, 0);
  ctx.lineTo(KOSTEL.x + 2, KOSTEL.y);
  ctx.fill();
  for (const x of [kostel.towerL[0] + 2.5, kostel.towerR[0] + 2.5, KOSTEL.x]) {
    ctx.fillRect(x - 0.6, x === KOSTEL.x ? KOSTEL.y - 31 : KOSTEL.y - 20, 1.2, 3);
  }
  label(ctx, c, 'Красный костёл', KOSTEL.x, KOSTEL.y + 6);

  // Комаровка
  ctx.fillStyle = c.cardElevated;
  ctx.beginPath();
  ctx.rect(KOMAR.x - KOMAR.rx - 1, KOMAR.y - 4, KOMAR.rx * 2 + 2, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.mustard;
  path(ctx, dome(KOMAR.x, KOMAR.y - 4, KOMAR.rx, KOMAR.ry));
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 1; k < 4; k++) {
    const rx = (KOMAR.rx * k) / 4;
    ctx.ellipse(KOMAR.x, KOMAR.y - 4, rx, KOMAR.ry, 0, Math.PI, Math.PI * 2);
  }
  ctx.moveTo(KOMAR.x, KOMAR.y - 4 - KOMAR.ry);
  ctx.lineTo(KOMAR.x, KOMAR.y - 4);
  ctx.stroke();
  ctx.lineWidth = line;
  ctx.fillStyle = c.ink;
  for (let x = KOMAR.x - 12; x <= KOMAR.x + 12; x += 6) ctx.fillRect(x - 1, KOMAR.y - 2.5, 2, 4);
  label(ctx, c, 'Комаровка', KOMAR.x, KOMAR.y + 9);

  // Ворота Минска
  for (const x0 of [GATES.l, GATES.r]) {
    ctx.fillStyle = c.cardElevated;
    for (const sh of gateTower(x0)) {
      if (sh.k !== 'poly') continue;
      path(ctx, sh.p);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = c.inkMuted;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) ctx.fillRect(x0 + 2.5 + col * 3.6, GATES.y0 + 9 + row * 4.6, 1.6, 2.4);
    }
    // фигуры на крыше
    ctx.fillStyle = c.ink;
    for (const dx of [3, GATES.w - 3]) {
      ctx.beginPath();
      ctx.arc(x0 + dx, GATES.y0 - 5.8, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // часы на левой башне, герб на правой
  ctx.fillStyle = c.paper;
  ctx.beginPath();
  ctx.arc(GATES.l + GATES.w / 2, GATES.y0 + 4.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(GATES.l + GATES.w / 2, GATES.y0 + 4.5);
  ctx.lineTo(GATES.l + GATES.w / 2, GATES.y0 + 2.6);
  ctx.moveTo(GATES.l + GATES.w / 2, GATES.y0 + 4.5);
  ctx.lineTo(GATES.l + GATES.w / 2 + 1.4, GATES.y0 + 4.5);
  ctx.stroke();
  ctx.fillStyle = c.sky;
  const gx = GATES.r + GATES.w / 2, gy = GATES.y0 + 2.4;
  path(ctx, [[gx - 2, gy], [gx + 2, gy], [gx + 2, gy + 2.6], [gx, gy + 4.2], [gx - 2, gy + 2.6]]);
  ctx.fill();
  ctx.stroke();
  label(ctx, c, 'Ворота Минска', (GATES.l + GATES.r + GATES.w) / 2, GATES.y1 + 6);

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
