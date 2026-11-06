import React from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { TRACTOR_TEXTS as T } from '../../texts/tractors';
import { GameSummary } from '../../games/types';
import { TractorPreview } from './TractorPreview';

/**
 * Первый экран «Трактора в Минске»: картинка поля, три строки правил, мои рекорды, рейтинг дня и «Поехали».
 * Правила здесь на виду, поэтому в самой игре они сами больше не открываются.
 */
export const TractorHome: React.FC<{ summary: GameSummary | null; onPlay: () => void; onBack: () => void }> = ({ summary, onPlay, onBack }) => {
  const t = summary?.tractor;
  const day = t?.day;
  return (
    <div className="flex flex-col h-full w-full bg-zine-paper overflow-hidden select-none">
      <header className="shrink-0 px-5 pt-4 pb-2 flex items-center gap-1">
        <button onClick={onBack} aria-label="Назад" className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-zine-ink cursor-pointer">
          <ArrowLeft size={24} />
        </button>
        <h1 className="flex-1 min-w-0 font-serif font-bold text-display text-zine-ink truncate">{T.title}</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 flex flex-col gap-3 [&>*]:shrink-0">
        <TractorPreview className="h-[min(30vh,240px)] rounded-zine border border-zine-border" />

        <div className="px-1 space-y-1">
          {T.rulesLines.map(([icon, text]) => (
            <p key={text} className="flex items-center gap-3 font-serif font-bold text-lead text-zine-ink">
              <span className="w-7 text-center text-[22px]">{icon}</span>
              {text}
            </p>
          ))}
          <p className="pt-1 text-sm2 text-zine-inkMuted">{T.homeHint}</p>
        </div>

        {/* Мои рекорды */}
        <div className="grid grid-cols-3 rounded-zine bg-zine-cardElevated border border-zine-border overflow-hidden">
          <Stat value={t ? String(t.wins) : '…'} label={T.statWins(t?.wins ?? 0)} />
          <Stat value={t ? `${t.best} с` : '…'} label={T.statBest} border />
          {t?.nemesis ? (
            <Stat value={T.nemesis[t.nemesis] || t.nemesis} label={T.statNemesis} border small />
          ) : (
            <Stat value={t ? String(t.roundWins) : '…'} label={T.statRoundWins} border />
          )}
        </div>

        {/* Рейтинг дня */}
        <section className="rounded-zine bg-zine-cardElevated border border-zine-border overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <Trophy size={18} className="text-zine-mustard shrink-0" />
            <h2 className="flex-1 font-bold text-body text-zine-ink">{T.dayTitle}</h2>
            {day && day.players > 0 && <span className="text-cap text-zine-inkMuted">{T.dayPlayers(day.players)}</span>}
          </div>
          {!day ? (
            <p className="px-4 pb-3 text-sm2 text-zine-inkMuted">…</p>
          ) : day.top.length === 0 ? (
            <p className="px-4 pb-3 text-sm2 text-zine-inkMuted">{T.dayEmpty}</p>
          ) : (
            <ol className="pb-1.5">
              {day.top.map((r) => (
                <li key={`${r.place}-${r.name}`} className={`px-4 h-10 flex items-center gap-3 text-body ${r.me ? 'bg-zine-terracotta/10 font-bold' : ''}`}>
                  <span className="w-6 text-center tabular-nums text-zine-inkMuted">{r.place <= 3 ? ['🥇', '🥈', '🥉'][r.place - 1] : `${r.place}`}</span>
                  <span className="flex-1 truncate text-zine-ink">{r.me ? `${r.name} (${T.you.toLowerCase()})` : r.name}</span>
                  <span className="tabular-nums text-zine-ink">{T.dayWins(r.wins)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <div className="shrink-0 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          onClick={() => {
            telegramService.haptic('medium');
            onPlay();
          }}
          className="w-full h-14 rounded-full bg-zine-terracotta text-white text-lead font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform shadow-zine"
        >
          🚜 {T.play}
        </button>
      </div>
    </div>
  );
};

const Stat: React.FC<{ value: string; label: string; border?: boolean; small?: boolean }> = ({ value, label, border, small }) => (
  <div className={`px-2 py-2.5 text-center min-w-0 ${border ? 'border-l border-zine-border' : ''}`}>
    <div className={`font-serif font-bold text-zine-ink truncate ${small ? 'text-body leading-7' : 'text-title'}`}>{value}</div>
    <div className="text-cap text-zine-inkMuted leading-4">{label}</div>
  </div>
);
