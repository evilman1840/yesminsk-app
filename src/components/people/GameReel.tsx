import React, { useEffect, useState } from 'react';
import { telegramService } from '../../services/telegram';
import { api } from '../../services/api';
import { GAME_TEXTS as T } from '../../texts/games';
import { GameLobby } from '../../games/types';
import { Cross, Nought } from '../map/GamesMascot';

/**
 * «Сыграем?» между анкетами. Три вида, случайно: человечки зовут, «сделай ход прямо тут»
 * и «кто-то ищет соперника» (только когда кто-то правда ищет).
 * До трёх раз за ленту (после 7-й, 17-й и 32-й анкеты); «Не показывать» — на 3 дня.
 * Хранится в браузере: это удобство, а не правило
 */

const HOUR = 60 * 60 * 1000;
const HIDE_KEY = 'yesminsk_game_reel_hidden_at';

const read = (key: string) => {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};
const write = (key: string) => {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* приватный режим */
  }
};

export const gameReelAllowed = () => Date.now() - read(HIDE_KEY) > 72 * HOUR;

// Как открыть игры из карточки
export type GameLaunch = { id?: string; code?: string; botCell?: number; search?: boolean };

// «Сделай ход»: кусочек 5×5 из середины поля 10×10, бот уже поставил крестик в центр
const MINI = 5;
const OFFSET = 2;
export const FEED_BOT_CELL = (OFFSET + 2) * 10 + (OFFSET + 2); // 44
const toCell = (i: number) => (Math.floor(i / MINI) + OFFSET) * 10 + (i % MINI) + OFFSET;

export type GameReelKind = 'mascots' | 'move' | 'waiting';
type Kind = GameReelKind;

// Порядок видов на ленту: все три по разу. «Кто-то ищет» — только первой или последней:
// если никто не ищет, её заменит вид, отличный от средней, и соседние карточки не повторятся
export const gameReelOrder = (): Kind[] => {
  const two: Kind[] = Math.random() < 0.5 ? ['mascots', 'move'] : ['move', 'mascots'];
  return Math.random() < 0.5 ? ['waiting', ...two] : [...two, 'waiting'];
};

export const GameReel: React.FC<{ kind?: Kind; fallback?: Kind; onPlay: (launch: GameLaunch) => void; onHide: () => void }> = ({ kind, fallback: fallbackKind, onPlay, onHide }) => {
  const [lobby, setLobby] = useState<GameLobby | null>(null);
  useEffect(() => {
    api.gameLobby().then(setLobby).catch(() => {});
  }, []);
  // Вид выбираем один раз; «кто-то ищет» — только если и правда ищут, иначе один из двух других
  const [pick] = useState<Kind>(() => kind || (['mascots', 'move', 'waiting'] as Kind[])[Math.floor(Math.random() * 3)]);
  const [fallback] = useState<Kind>(() => fallbackKind || (Math.random() < 0.5 ? 'mascots' : 'move'));
  const shown: Kind = pick === 'waiting' && !(lobby && lobby.searching > 0) ? fallback : pick;

  const play = (launch: GameLaunch) => {
    telegramService.haptic('medium');
    onPlay(launch);
  };
  const hide = () => {
    telegramService.haptic('selection');
    write(HIDE_KEY);
    onHide();
  };

  const waiting = shown === 'waiting';
  return (
    <section className="h-full w-full snap-start snap-always p-3">
      <div
        className={`h-full rounded-zine border flex flex-col items-center justify-center text-center px-6 text-zine-ink ${
          waiting ? 'bg-zine-sage/15 border-zine-sage/40' : 'bg-zine-card border-zine-border'
        }`}
      >
        {shown === 'mascots' && (
          <>
            <span className="px-3 py-1 rounded-zine-sm bg-zine-paper text-zine-ink text-body font-bold border-2 border-zine-ink shadow-zine-sm">{T.reelSign}</span>
            <span className="mt-2 flex items-end gap-3">
              <Cross size={72} className="game-hop game-hop-fast" />
              <Nought size={72} className="game-hop game-hop-fast game-hop-late" />
            </span>
            <h2 className="mt-4 font-serif font-bold text-display">{T.title}</h2>
            <p className="mt-1 text-body text-zine-inkMuted">{T.reelMascotsHint}</p>
            {lobby && lobby.searching > 0 && <LiveChip n={lobby.searching} />}
            <button onClick={() => play({})} className="mt-5 w-full max-w-[280px] h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
              {T.reelPlay}
            </button>
          </>
        )}

        {shown === 'move' && (
          <>
            <h2 className="font-serif font-bold text-display">{T.reelMoveTitle}</h2>
            <p className="mt-1 text-body text-zine-inkMuted">{T.reelMoveHint}</p>
            <div className="relative mt-5">
              <div className="grid grid-cols-5 gap-px p-px rounded-zine-sm bg-zine-border" role="group" aria-label={T.reelMoveTitle}>
                {Array.from({ length: MINI * MINI }, (_, i) => {
                  const cell = toCell(i);
                  const isBot = cell === FEED_BOT_CELL;
                  const hint = !isBot && Math.abs(cell - FEED_BOT_CELL) === 1; // соседние клетки подсвечиваем: «сюда»
                  return (
                    <button
                      key={i}
                      onClick={() => !isBot && play({ botCell: cell })}
                      disabled={isBot}
                      aria-label={isBot ? 'Крестик бота' : 'Поставить нолик'}
                      className={`w-12 h-12 flex items-center justify-center cursor-pointer active:bg-zine-terracotta/20 ${
                        isBot ? 'bg-zine-terracotta/15' : hint ? 'bg-zine-cardElevated game-cell-hint' : 'bg-zine-cardElevated'
                      }`}
                    >
                      {isBot && (
                        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
                          <path d="M4 4 L18 18 M18 4 L4 18" stroke="rgb(var(--c-terracotta))" strokeWidth="3.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <span className="absolute -right-9 -bottom-4 pointer-events-none">
                <Nought size={40} className="game-hop game-hop-fast" />
              </span>
            </div>
            <button onClick={() => play({ search: true })} className="mt-6 h-11 px-3 text-body font-semibold text-zine-terracotta cursor-pointer">
              {T.reelMoveHuman}
            </button>
          </>
        )}

        {waiting && lobby && (
          <>
            <span className="flex items-end gap-2">
              <Cross size={56} className="game-hop game-hop-fast" />
              <span className="mb-3 w-14 h-14 rounded-full border-2 border-dashed border-zine-sage flex items-center justify-center text-[26px] font-bold text-zine-sage">?</span>
            </span>
            <LiveChip n={lobby.searching} label={T.reelWaitingNow} />
            <h2 className="mt-3 font-serif font-bold text-display">{T.reelWaitingTitle}</h2>
            <p className="mt-1 text-body text-zine-inkMuted">{T.reelWaitingHint}</p>
            <button onClick={() => play({ search: true })} className="mt-5 w-full max-w-[280px] h-12 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-[0.98] transition-transform">
              {T.reelWaitingPlay}
            </button>
          </>
        )}

        <button onClick={hide} className="mt-3 h-10 px-3 text-cap font-semibold text-zine-inkMuted cursor-pointer">
          {T.reelHide}
        </button>
        <p className="text-cap text-zine-inkMuted">{T.reelScroll}</p>
      </div>
    </section>
  );
};

const LiveChip: React.FC<{ n: number; label?: string }> = ({ n, label }) => (
  <span className="mt-3 inline-flex items-center gap-2 h-7 px-3 rounded-full bg-zine-sage/20 text-sm2 font-semibold text-zine-ink">
    <span className="relative w-2 h-2 rounded-full bg-zine-sage game-live-dot" aria-hidden />
    {label || T.liveSearching(n)}
  </span>
);
