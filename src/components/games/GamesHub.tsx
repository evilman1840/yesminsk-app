import React from 'react';
import { GameSummary, GameLobby, GameView, SeaLobby } from '../../games/types';
import { SEA_TEXTS as ST } from '../../texts/sea';
import { TRACTOR_TEXTS as TT } from '../../texts/tractors';
import { GAME_TEXTS as T } from '../../texts/games';
import { telegramService } from '../../services/telegram';
import { TractorPreview } from './TractorPreview';

/**
 * Меню «Игры»: две игры поровну, у каждой — картинка, суть в одну строку и три цифры, которые зовут сыграть.
 * Крестики-Нолики: сколько партий сыграно в приложении, сколько людей ищут соперника прямо сейчас, сколько человек играли с живыми людьми.
 * Трактор: сколько матчей сыграно у всех, сколько человек играли сегодня, кто лидер дня.
 */
export const GamesHub: React.FC<{
  summary: GameSummary | null;
  lobby: GameLobby | null;
  mine: GameView[];
  boardArt: React.ReactNode;
  onFive: () => void;
  onTractor: () => void;
  seaLobby: SeaLobby | null;
  seaArt: React.ReactNode;
  onSea: () => void;
}> = ({ summary, lobby, mine, boardArt, onFive, onTractor, seaLobby, seaArt, onSea }) => {
  const tr = summary?.tractor;
  const open = (fn: () => void) => () => {
    telegramService.haptic('light');
    fn();
  };
  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
      <GameCard
        onClick={open(onFive)}
        art={<div className="absolute inset-0 flex items-center justify-center bg-zine-card">{boardArt}</div>}
        badge={
          <span className="h-6 px-2.5 rounded-full bg-zine-cardElevated border border-zine-sage/40 text-cap font-semibold text-zine-sage flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zine-sage" />
            {T.hubLive}
          </span>
        }
        title={T.title}
        hint={T.hubHint}
        stats={[
          { value: lobby?.totalGames != null ? lobby.totalGames.toLocaleString('ru-RU') : '…', label: T.hubGames(lobby?.totalGames ?? 0) },
          { value: lobby ? String(lobby.searching) : '…', label: T.hubSearching, tone: lobby?.searching ? 'text-zine-sage' : '' },
          { value: lobby?.livePlayers != null ? lobby.livePlayers.toLocaleString('ru-RU') : '…', label: T.hubLivePlayers }
        ]}
      />
      <GameCard
        onClick={open(onSea)}
        art={<div className="absolute inset-0 flex items-center justify-center bg-zine-sky/10">{seaArt}</div>}
        badge={<span className="h-6 px-2.5 rounded-full bg-zine-terracotta text-white text-cap font-semibold flex items-center">{ST.badgeNew}</span>}
        title={ST.title}
        hint={ST.cardHint}
        stats={[
          { value: seaLobby ? seaLobby.totalGames.toLocaleString('ru-RU') : '…', label: ST.hubGames(seaLobby?.totalGames ?? 0) },
          { value: seaLobby ? String(seaLobby.searching) : '…', label: ST.hubSearching, tone: seaLobby?.searching ? 'text-zine-sage' : '' },
          { value: seaLobby ? String(seaLobby.playing) : '…', label: ST.hubPlaying, tone: seaLobby?.playing ? 'text-zine-sage' : '' }
        ]}
      />
      <GameCard
        onClick={open(onTractor)}
        art={<TractorPreview className="absolute inset-0" />}
        badge={<span className="h-6 px-2.5 rounded-full bg-zine-terracotta text-white text-cap font-semibold flex items-center">{TT.badgeNew}</span>}
        title={TT.title}
        hint={TT.cardHint}
        stats={[
          { value: tr?.all ? tr.all.games.toLocaleString('ru-RU') : '…', label: TT.hubGames(tr?.all?.games ?? 0) },
          { value: tr ? String(tr.day.players) : '…', label: TT.hubToday, tone: tr?.day.players ? 'text-zine-sage' : '' },
          !tr
            ? { value: '…', label: TT.hubLeader }
            : tr.day.top[0]
              ? { value: tr.day.top[0].name, label: tr.day.top[0].me ? TT.hubLeaderMe : TT.hubLeader, tone: 'text-zine-terracotta', small: true }
              : { value: '🏆', label: TT.hubLeaderNone }
        ]}
      />
    </main>
  );
};

const GameCard: React.FC<{
  onClick: () => void;
  art: React.ReactNode;
  badge: React.ReactNode;
  title: string;
  hint: string;
  stats: { value: string; label: string; tone?: string; small?: boolean }[];
}> = ({ onClick, art, badge, title, hint, stats }) => (
  <button
    onClick={onClick}
    className="shrink-0 w-full flex flex-col text-left rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
  >
    {/* Картинка — постоянной высоты: карточек три, меню прокручивается, и сжимать её нельзя */}
    <div className="relative h-[156px] shrink-0 overflow-hidden">
      {art}
      <div className="absolute left-3 top-3">{badge}</div>
    </div>
    <div className="px-4 pt-2.5 pb-2">
      <div className="font-serif font-bold text-title text-zine-ink">{title}</div>
      <div className="text-sm2 text-zine-inkMuted leading-5">{hint}</div>
    </div>
    <div className="grid grid-cols-3 border-t border-zine-border">
      {stats.map((s, i) => (
        <div key={i} className={`px-1.5 py-2 text-center min-w-0 ${i ? 'border-l border-zine-border' : ''}`}>
          <div className={`font-serif font-bold leading-6 tabular-nums truncate ${s.small ? 'text-body' : 'text-lead'} ${s.tone || 'text-zine-ink'}`}>{s.value}</div>
          <div className="text-[12px] leading-4 text-zine-inkMuted">{s.label}</div>
        </div>
      ))}
    </div>
  </button>
);
