/**
 * «Морской бой»: правила и бот. Те же правила проверяет сервер (sea.ts) в партиях с людьми.
 * Поле 10×10. Флот — строка из 100 символов: '.' вода, '0'…'9' номер корабля.
 * Выстрелы — строка из 100 символов: '.' не стрелял, 'm' мимо, 'h' попал, 'a' пусто рядом с потопленным (отмечено само).
 * В «виде» выстрелов подбитые клетки потопленного корабля — 's'
 */

export const SEA = 10;
export const SEA_CELLS = SEA * SEA;
export const SEA_SHIPS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
const SHIP_CELLS = SEA_SHIPS.reduce((a, b) => a + b, 0);
export const SEA_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];

export const emptyShots = () => '.'.repeat(SEA_CELLS);
const rc = (cell: number) => [Math.floor(cell / SEA), cell % SEA];
const inside = (r: number, c: number) => r >= 0 && r < SEA && c >= 0 && c < SEA;

export function around(cell: number): number[] {
  const [r, c] = rc(cell);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && inside(r + dr, c + dc)) out.push((r + dr) * SEA + c + dc);
  return out;
}

export function validFleet(fleet: string): boolean {
  if (fleet.length !== SEA_CELLS || !/^[.0-9]+$/.test(fleet)) return false;
  const cells: number[][] = SEA_SHIPS.map(() => []);
  for (let i = 0; i < SEA_CELLS; i++) if (fleet[i] !== '.') cells[Number(fleet[i])].push(i);
  for (let s = 0; s < SEA_SHIPS.length; s++) {
    const list = cells[s];
    if (list.length !== SEA_SHIPS[s]) return false;
    const rows = new Set(list.map((c) => rc(c)[0])), cols = new Set(list.map((c) => rc(c)[1]));
    if (rows.size !== 1 && cols.size !== 1) return false;
    const step = rows.size === 1 ? 1 : SEA;
    for (let k = 1; k < list.length; k++) if (list[k] - list[k - 1] !== step) return false;
    for (const c of list) for (const n of around(c)) if (fleet[n] !== '.' && fleet[n] !== fleet[c]) return false;
  }
  return true;
}

export function randomFleet(): string {
  for (;;) {
    const f = Array(SEA_CELLS).fill('.');
    let ok = true;
    for (let s = 0; s < SEA_SHIPS.length && ok; s++) {
      ok = false;
      for (let tries = 0; tries < 200 && !ok; tries++) {
        const horiz = Math.random() < 0.5;
        const len = SEA_SHIPS[s];
        const r = Math.floor(Math.random() * (horiz ? SEA : SEA - len + 1));
        const c = Math.floor(Math.random() * (horiz ? SEA - len + 1 : SEA));
        const list = Array.from({ length: len }, (_, k) => (horiz ? r * SEA + c + k : (r + k) * SEA + c));
        if (list.some((x) => f[x] !== '.' || around(x).some((n) => f[n] !== '.'))) continue;
        list.forEach((x) => (f[x] = String(s)));
        ok = true;
      }
    }
    if (ok) return f.join('');
  }
}

/** Повернуть корабль, на который нажали. Пробуем повернуть вокруг каждой его клетки; не помещается — null */
export function rotateShip(fleet: string, cell: number): string | null {
  const ship = fleet[cell];
  if (ship === '.') return null;
  const list: number[] = [];
  for (let i = 0; i < SEA_CELLS; i++) if (fleet[i] === ship) list.push(i);
  if (list.length === 1) return null;
  const horiz = rc(list[0])[0] === rc(list[1])[0];
  const base = fleet.replace(new RegExp(ship, 'g'), '.');
  // Сначала — вокруг клетки, на которую нажали, потом вокруг остальных
  const anchors = [list.indexOf(cell), ...list.map((_, k) => k).filter((k) => k !== list.indexOf(cell))];
  for (const k of anchors) {
    // Клетка k остаётся на месте, корабль ложится поперёк через неё
    const [pr, pc] = rc(list[k]);
    const cells = list.map((_, j) => (horiz ? [pr - k + j, pc] : [pr, pc - k + j]));
    if (cells.some(([r, c]) => !inside(r, c))) continue;
    const f = base.split('');
    cells.forEach(([r, c]) => (f[r * SEA + c] = ship));
    const next = f.join('');
    if (validFleet(next)) return next;
  }
  return null;
}

function sunkShips(fleet: string, shots: string): Set<string> {
  const left = new Map<string, number>();
  for (let i = 0; i < SEA_CELLS; i++) if (fleet[i] !== '.' && shots[i] !== 'h') left.set(fleet[i], (left.get(fleet[i]) || 0) + 1);
  return new Set(SEA_SHIPS.map((_, s) => String(s)).filter((s) => !left.get(s)));
}

export function shotView(fleet: string, shots: string): string {
  const sunk = sunkShips(fleet, shots);
  return Array.from(shots, (ch, i) => (ch === 'h' && sunk.has(fleet[i]) ? 's' : ch)).join('');
}

export const shipsLeft = (fleet: string, shots: string) => SEA_SHIPS.length - sunkShips(fleet, shots).size;

export type ShotResult = 'miss' | 'hit' | 'sunk';

export function fire(fleet: string, shots: string, cell: number): { shots: string; result: ShotResult; won: boolean } {
  const s = shots.split('');
  if (fleet[cell] === '.') {
    s[cell] = 'm';
    return { shots: s.join(''), result: 'miss', won: false };
  }
  s[cell] = 'h';
  const ship = fleet[cell];
  const shipCells: number[] = [];
  for (let i = 0; i < SEA_CELLS; i++) if (fleet[i] === ship) shipCells.push(i);
  const sunk = shipCells.every((c) => s[c] === 'h');
  if (sunk) for (const c of shipCells) for (const n of around(c)) if (s[n] === '.') s[n] = 'a';
  const won = s.filter((ch) => ch === 'h').length === SHIP_CELLS;
  return { shots: s.join(''), result: sunk ? 'sunk' : 'hit', won };
}

// Что видно по выстрелам: какие корабли ещё плавают (размеры). Потопленные считаем по 's'
function sunkSizes(view: string): number[] {
  const seen = new Set<number>();
  const sizes: number[] = [];
  for (let i = 0; i < SEA_CELLS; i++) {
    if (view[i] !== 's' || seen.has(i)) continue;
    const stack = [i];
    let n = 0;
    seen.add(i);
    while (stack.length) {
      const c = stack.pop()!;
      n++;
      const [r, cc] = rc(c);
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = r + dr, nc = cc + dc;
        const x = nr * SEA + nc;
        if (inside(nr, nc) && view[x] === 's' && !seen.has(x)) {
          seen.add(x);
          stack.push(x);
        }
      }
    }
    sizes.push(n);
  }
  return sizes;
}

export type SeaBotLevel = 'easy' | 'normal';

/**
 * Куда стреляет бот. view — его выстрелы глазами стрелявшего ('.', 'm', 'a', 'h', 's').
 * Ранил — добивает (полегче: соседние клетки наугад; посложнее: вдоль линии попаданий).
 * Ищет — полегче: наугад; посложнее: клетка, через которую проходит больше всего возможных кораблей
 */
export function botShot(view: string, level: SeaBotLevel): number {
  const free = (i: number) => view[i] === '.';
  const hits: number[] = [];
  for (let i = 0; i < SEA_CELLS; i++) if (view[i] === 'h') hits.push(i);
  const pick = <V,>(list: V[]) => list[Math.floor(Math.random() * list.length)];

  if (hits.length) {
    let options: number[] = [];
    if (level === 'normal' && hits.length > 1) {
      const horiz = rc(hits[0])[0] === rc(hits[1])[0];
      const sorted = [...hits].sort((a, b) => a - b);
      const step = horiz ? 1 : SEA;
      const [fr, fc] = rc(sorted[0]), [lr, lc] = rc(sorted[sorted.length - 1]);
      const before = horiz ? [fr, fc - 1] : [fr - 1, fc];
      const after = horiz ? [lr, lc + 1] : [lr + 1, lc];
      options = [before, after].filter(([r, c]) => inside(r, c)).map(([r, c]) => r * SEA + c).filter(free);
      if (!options.length) options = [sorted[0] - step, sorted[sorted.length - 1] + step].filter((x) => x >= 0 && x < SEA_CELLS && free(x));
    }
    if (!options.length) {
      for (const h of hits) {
        const [r, c] = rc(h);
        for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (inside(r + dr, c + dc) && free((r + dr) * SEA + c + dc)) options.push((r + dr) * SEA + c + dc);
      }
    }
    if (options.length) return pick(options);
  }

  const open: number[] = [];
  for (let i = 0; i < SEA_CELLS; i++) if (free(i)) open.push(i);
  if (level === 'easy') return pick(open);

  // Плотность: сколько ещё не найденных кораблей может пройти через клетку
  const remaining = [...SEA_SHIPS];
  for (const s of sunkSizes(view)) {
    const k = remaining.indexOf(s);
    if (k >= 0) remaining.splice(k, 1);
  }
  const score = new Array(SEA_CELLS).fill(0);
  for (const len of remaining) {
    for (let r = 0; r < SEA; r++)
      for (let c = 0; c < SEA; c++)
        for (const horiz of [true, false]) {
          const cells = Array.from({ length: len }, (_, k) => (horiz ? [r, c + k] : [r + k, c]));
          if (cells.some(([rr, cc]) => !inside(rr, cc) || !free(rr * SEA + cc))) continue;
          cells.forEach(([rr, cc]) => score[rr * SEA + cc]++);
        }
  }
  const best = Math.max(...open.map((i) => score[i]));
  return pick(open.filter((i) => score[i] === best));
}
