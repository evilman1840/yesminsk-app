import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MeetupStats, WishSummaryItem, WishWindow } from '../../types';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { askBotAccess } from '../../services/botAccess';
import { WISH_TEXTS as T, wishProgress, cheerLines } from '../../texts/wishes';

// Ближайшее время важнее: «сегодня» поднимаем сильнее, чем «на неделе»
const WINDOW_BOOST: Record<WishWindow, number> = { today: 3, tomorrow: 2, weekend: 1.5, week: 1 };

// Чужие желания для карточек в ленте: где я ещё не отметился(ась), больше людей и ближе время — раньше.
// «Погулять на неделе» в разных местах — одно и то же: берём то, где больше людей
export const pickReelWishes = (summary: WishSummaryItem[]) =>
  summary
    .filter((s) => !s.includesMe && s.count > 0)
    .sort((a, b) => b.count * WINDOW_BOOST[b.timeWindow] - a.count * WINDOW_BOOST[a.timeWindow])
    .filter((x, i, all) => all.findIndex((y) => y.kind === x.kind && y.sport === x.sport && y.timeWindow === x.timeWindow) === i);

// Куда в ленте вставить карточки: после 4-й и 10-й; карточек в ленте меньше 4 — одна в конце. Номер — какая по счёту
export const reelSlotAfter = (index: number, total: number): number | null =>
  index === 3 ? 0 : index === 9 ? 1 : total < 4 && index === total - 1 ? 0 : null;

/**
 * Карточка «Хочу сходить» между сходками и анкетами: чужое желание — «И я хочу» в одно нажатие,
 * дальше прямо тут видно, сколько вас; чужих нет — позвать отметить своё
 */
export const WishReel: React.FC<{
  wish: WishSummaryItem | null;
  proposeAt: number;
  onWho?: (wish: WishSummaryItem) => void;
  onOpen: () => void;
  onChanged?: () => void;
  promptTitle?: string; // своя карточка без чужих желаний: в «Людях» про сходки не спрашиваем
  stats?: MeetupStats | null;
}> = ({ wish, proposeAt, onWho, onOpen, onChanged, promptTitle = T.reelPromptTitle, stats }) => {
  // Одна подбадривающая фраза на карточку: выбираем при появлении, чтобы не прыгала при обновлениях
  const [cheerSeed] = useState(Math.random);
  const cheers = cheerLines(stats);
  const cheer = cheers[Math.floor(cheerSeed * cheers.length)];
  // После «И я хочу» список желаний обновится и это желание уйдёт из чужих — держим его на карточке
  const [shown, setShown] = useState(wish);
  const [joined, setJoined] = useState<number | null>(null); // сколько нас в группе после отметки
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (joined === null) setShown(wish);
  }, [wish, joined]);

  const join = async () => {
    if (!shown || busy) return;
    telegramService.haptic('light');
    askBotAccess();
    setBusy(true);
    try {
      const res = await api.createWish({ kind: shown.kind, sport: shown.sport, timeWindow: shown.timeWindow, placeId: shown.placeId });
      telegramService.haptic('success');
      setJoined(res.wish?.groupSize || 0);
      onChanged?.();
    } catch (err: any) {
      telegramService.haptic('error');
      telegramService.alert(err?.message || T.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="h-full w-full snap-start snap-always p-3">
      <div className="h-full rounded-zine bg-zine-card border border-zine-border flex flex-col items-center justify-center text-center px-6 text-zine-ink">
        <div className="text-[56px] leading-none mb-4" aria-hidden>
          {joined !== null ? '🙌' : '🙋'}
        </div>
        {shown ? (
          <>
            <p className="font-serif font-bold text-title">{T.barCounter(shown.count + (joined !== null ? 1 : 0), shown.what, shown.when)}</p>
            {joined !== null ? (
              <>
                <p className="mt-3 text-body font-semibold text-zine-ink">{joined >= 2 ? wishProgress(joined, proposeAt) : T.toastText}</p>
                <p className="mt-2 text-sm2 text-zine-inkMuted">
                  {T.joinedCalm} {T.joinedUndo}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lead text-zine-inkMuted">{T.reelAsk}</p>
                <p className="mt-4 max-w-[280px] text-sm2 text-zine-inkMuted">{cheer}</p>
                <button
                  onClick={join}
                  disabled={busy}
                  className="mt-6 h-12 min-w-[160px] px-6 rounded-full bg-zine-terracotta text-white text-body font-bold flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                >
                  {busy ? <Loader2 size={20} className="animate-spin" /> : T.reelMeToo}
                </button>
              </>
            )}
            {onWho && (
              <button onClick={() => onWho(shown)} className="mt-3 h-11 px-5 rounded-full text-zine-ink text-body font-semibold cursor-pointer">
                {T.reelWho}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="font-serif font-bold text-title">{promptTitle}</p>
            <p className="mt-2 text-body text-zine-inkMuted">{T.reelPromptText}</p>
            <p className="mt-4 max-w-[280px] text-sm2 text-zine-inkMuted">{cheer}</p>
            <button onClick={onOpen} className="mt-6 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold active:scale-95 transition-transform cursor-pointer">
              {T.reelPromptButton}
            </button>
          </>
        )}
      </div>
    </section>
  );
};
