/** Партия так, как её присылает сервер (и так же устроена партия с ботом) */
export interface GamePlayer {
  incognito: boolean;
  telegramId?: number; // нет у соперника в инкогнито и у бота
  name: string;
  avatar: string;
  emoji: string;       // зверёк инкогнито или 🤖
  rematch: boolean;
  online: boolean;
  away?: boolean; // свернул приложение
  isBot?: boolean;
  level?: string;      // у бота: «полегче» или «посложнее»
}

export type GameStatus = 'searching' | 'waiting' | 'active' | 'finished' | 'cancelled';
export type GameReason = 'win' | 'draw' | 'resign' | 'left' | 'expired';

// Меню игр: живой счётчик
export interface GameLobby {
  searching: number;
  playing: number;
  today: number;
  notify: boolean;
  canMessage: boolean;
  eveningHour: number;
  eveningNow: boolean;
}

export interface GameView {
  id: string;
  game: string;
  mode: 'random' | 'invite' | 'bot';
  status: GameStatus;
  v?: number;          // версия партии на сервере: растёт с каждым изменением
  inviteCode?: string;
  board: string;
  size: number;
  turn: number;
  me: number;
  moves: number;
  lastMove: number;
  winner: number;
  winLine?: number[];
  reason?: GameReason;
  say?: { from: number; text: string; at: string };
  nextId?: string;
  players: GamePlayer[];
  updatedAt?: string;
}

// Мои победы и рекорды в играх (GET /api/games/summary)
export interface GameSummary {
  five: { games: number; wins: number };
  tractor: {
    games: number;
    wins: number;
    rounds: number;
    roundWins: number;
    best: number; // дольше всего на ходу в раунде, секунд
    nemesis: string | null; // обо что чаще всего врезается: 'stela', 'river', 'own'…
    day: { players: number; myPlace: number | null; top: { place: number; name: string; wins: number; me: boolean }[] };
  };
}

// «Трактор в Минске»: итог матча (POST /api/games/tractor/match)
export interface TractorMatchResult {
  won: boolean;
  rounds: number;
  roundWins: number;
  best: number;
  crash: Record<string, number>;
}
