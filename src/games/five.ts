/**
 * «Крестики-Нолики»: правила и бот. Те же правила проверяет сервер (games.ts) в партиях с людьми.
 * Доска — строка из 100 символов: '.' пусто, 'x' крестик (ходит первым), 'o' нолик
 */

export const SIZE = 10;
export const CELLS = SIZE * SIZE;
const WIN = 5;
const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

export const emptyBoard = () => '.'.repeat(CELLS);
export const place = (board: string, cell: number, mark: 'x' | 'o') => board.slice(0, cell) + mark + board.slice(cell + 1);

const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** Пять (или больше) в ряд через клетку — линия клеток, иначе null */
export function winLineAt(board: string, cell: number): number[] | null {
  const mark = board[cell];
  if (mark === '.') return null;
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  for (const [dr, dc] of DIRS) {
    const line = [cell];
    for (const s of [1, -1]) {
      let r = r0 + dr * s, c = c0 + dc * s;
      while (inside(r, c) && board[r * SIZE + c] === mark) {
        line.push(r * SIZE + c);
        r += dr * s;
        c += dc * s;
      }
    }
    if (line.length >= WIN) return line.sort((a, b) => a - b);
  }
  return null;
}

// Сколько своих подряд получится через клетку в направлении и сколько концов линии свободны
function lineAt(board: string, cell: number, mark: string, dr: number, dc: number): { count: number; open: number } {
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  let count = 1, open = 0;
  for (const s of [1, -1]) {
    let r = r0 + dr * s, c = c0 + dc * s;
    while (inside(r, c) && board[r * SIZE + c] === mark) {
      count++;
      r += dr * s;
      c += dc * s;
    }
    if (inside(r, c) && board[r * SIZE + c] === '.') open++;
  }
  return { count, open };
}

// Насколько хороша линия: пять — победа, открытая четвёрка — почти победа и т.д.
function lineScore(count: number, open: number): number {
  if (count >= 5) return 1_000_000;
  if (open === 0) return 0;
  if (count === 4) return open === 2 ? 100_000 : 8_000;
  if (count === 3) return open === 2 ? 6_000 : 400;
  if (count === 2) return open === 2 ? 300 : 40;
  return open === 2 ? 12 : 3;
}

function cellScore(board: string, cell: number, mark: string): number {
  let sum = 0;
  for (const [dr, dc] of DIRS) {
    const { count, open } = lineAt(board, cell, mark, dr, dc);
    sum += lineScore(count, open);
  }
  return sum;
}

// Кандидаты: пустые клетки не дальше двух от уже стоящих фигур
function candidates(board: string): number[] {
  if (!board.includes('x') && !board.includes('o')) return [Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2) - (Math.random() < 0.5 ? 1 : 0)];
  const out: number[] = [];
  for (let cell = 0; cell < CELLS; cell++) {
    if (board[cell] !== '.') continue;
    const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
    let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++)
      for (let dc = -2; dc <= 2 && !near; dc++) if (inside(r0 + dr, c0 + dc) && board[(r0 + dr) * SIZE + c0 + dc] !== '.') near = true;
    if (near) out.push(cell);
  }
  return out;
}

export type BotLevel = 'easy' | 'normal';

/**
 * Ход бота. «Полегче» — иногда не замечает угрозу и ходит не лучшим ходом, «Обычный» — играет всерьёз,
 * но тоже не идеально: это игра, чтобы отдохнуть
 */
export function botMove(board: string, mark: 'x' | 'o', level: BotLevel): number {
  const enemy = mark === 'x' ? 'o' : 'x';
  const scored = candidates(board)
    .map((cell) => {
      const attack = cellScore(board, cell, mark);
      const defense = cellScore(board, cell, enemy);
      // Свою победу видит всегда; защиту на «Полегче» — не всегда
      const careless = level === 'easy' && defense < 1_000_000 && Math.random() < 0.35;
      return { cell, score: attack * 1.1 + (careless ? defense * 0.15 : defense) + Math.random() * (level === 'easy' ? 400 : 20) };
    })
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return board.indexOf('.');
  if (level === 'easy' && scored.length > 2 && scored[0].score < 100_000 && Math.random() < 0.3) return scored[1 + Math.floor(Math.random() * 2)].cell;
  return scored[0].cell;
}
