/** Партия так, как её присылает сервер (и так же устроена партия с ботом) */
export interface GamePlayer {
  incognito: boolean;
  telegramId?: number; // нет у соперника в инкогнито и у бота
  name: string;
  avatar: string;
  emoji: string;       // зверёк инкогнито или 🤖
  rematch: boolean;
  online: boolean;
  isBot?: boolean;
  level?: string;      // у бота: «полегче» или «посложнее»
}

export type GameStatus = 'searching' | 'waiting' | 'active' | 'finished' | 'cancelled';
export type GameReason = 'win' | 'draw' | 'resign' | 'left' | 'expired';

export interface GameView {
  id: string;
  game: string;
  mode: 'random' | 'invite' | 'bot';
  status: GameStatus;
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
