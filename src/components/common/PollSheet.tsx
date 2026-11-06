import React, { useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { PollData, POLL_CUSTOM } from '../../types';
import { POLL_TEXTS as T } from '../../texts/poll';

const CUSTOM_MAX = 200;

// Строка в шапке после голоса: «🗳 Отдам даром · 54%»; ничья — «🗳 Пока поровну»
export const pollLeaderText = (poll: PollData) => {
  if (!poll.results?.length) return null;
  const top = Math.max(...poll.results.map((r) => r.percent));
  const leaders = poll.results.filter((r) => r.percent === top);
  if (leaders.length > 1 || top === 0) return T.leaderTie;
  if (leaders[0].key === POLL_CUSTOM) return T.leader(T.leaderIdeas, Math.round(top));
  const o = poll.options.find((x) => x.key === leaders[0].key);
  if (!o) return null;
  const short = o.short || o.label.split(/\s+/)[0];
  return T.leader(short.charAt(0).toUpperCase() + short.slice(1), Math.round(top));
};

/**
 * Опрос автора: можно отметить несколько вариантов и отправить, «Свой вариант» раскрывает поле.
 * После голоса — итоги полосками (доля проголосовавших за каждый) и мягкий призыв к донату
 */
export const PollSheet: React.FC<{
  poll: PollData;
  onClose: () => void;
  onVoted: (poll: PollData) => void;
  onDonate: () => void;
  onAction?: (tab: string) => void;
}> = ({ poll, onClose, onVoted, onDonate, onAction }) => {
  const [isRevoting, setIsRevoting] = useState(false);
  const [picked, setPicked] = useState<string[]>(poll.myVote?.options || []);
  const [custom, setCustom] = useState(poll.myVote?.custom || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCustomOpen = picked.includes(POLL_CUSTOM);

  const toggle = (key: string) => {
    telegramService.haptic('selection');
    setError(null);
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const vote = async () => {
    if (busy) return;
    if (!picked.length) return setError(T.pickFirst);
    if (isCustomOpen && !custom.trim()) return setError('Напиши свой вариант');
    setError(null);
    setBusy(true);
    try {
      const next = await api.votePoll(poll.id, picked, isCustomOpen ? custom.trim() : undefined);
      telegramService.haptic('success');
      setIsRevoting(false);
      onVoted(next);
    } catch (err: any) {
      setError(err?.message || 'Не получилось сохранить голос, попробуй ещё раз');
    } finally {
      setBusy(false);
    }
  };

  const showResults = Boolean(poll.myVote && poll.results) && !isRevoting;
  const labelOf = (key: string) =>
    key === POLL_CUSTOM ? { emoji: '✏️', label: T.ownIdeas } : poll.options.find((o) => o.key === key) || { emoji: '', label: key };

  if (showResults) {
    const mine = poll.myVote!.options;
    return (
      <BottomSheet
        title={T.title}
        onClose={onClose}
        footer={
          <div className="space-y-2">
            {poll.action && onAction ? (
              // Опрос с призывом: главная кнопка — само действие (например, сыграть партию)
              <button
                onClick={() => {
                  telegramService.haptic('medium');
                  onAction(poll.action!.tab);
                }}
                className="w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
              >
                {poll.action.text}
              </button>
            ) : (
              <button
                onClick={onDonate}
                className="w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="heartbeat block">❤️</span>
                {T.donate}
              </button>
            )}
            <button onClick={onClose} className="w-full h-11 rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-bold cursor-pointer">
              {T.done}
            </button>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-lead font-bold text-zine-ink">{T.thanks}</p>
          <span className="shrink-0 h-6 px-2.5 rounded-full bg-zine-sage/15 text-zine-sage text-cap font-bold leading-6">{T.counted}</span>
        </div>
        <p className="mt-1 text-sm2 text-zine-inkMuted">{poll.question}</p>

        <div className="mt-4 space-y-3.5">
          {poll.results!.map(({ key, percent }) => {
            const o = labelOf(key);
            const isMine = mine.includes(key);
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between gap-3 text-sm2">
                  <span className="min-w-0 text-zine-ink">
                    {o.emoji && <span className="mr-1.5">{o.emoji}</span>}
                    {o.label}
                    {isMine && <span className="font-bold text-zine-terracotta"> · {T.mine}</span>}
                  </span>
                  <span className={`shrink-0 tabular-nums ${isMine ? 'font-bold text-zine-ink' : 'text-zine-inkMuted'}`}>{percent}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-zine-card overflow-hidden">
                  <div className={`h-full rounded-full bg-zine-terracotta ${isMine ? '' : 'opacity-40'}`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {mine.includes(POLL_CUSTOM) && poll.myVote!.custom && <p className="mt-3 text-sm2 text-zine-inkMuted">{T.myIdea(poll.myVote!.custom)}</p>}
        <p className="mt-3 text-cap text-zine-inkMuted">{T.votes(poll.total)}</p>

        {!poll.action && <div className="mt-4 p-3.5 rounded-zine-sm bg-zine-card text-sm2 text-zine-ink">{T.donateNote}</div>}
        <button
          onClick={() => {
            setPicked(mine);
            setIsRevoting(true);
          }}
          className="mt-3 h-10 text-sm2 font-semibold text-zine-inkMuted underline underline-offset-2 cursor-pointer"
        >
          {T.revote}
        </button>
      </BottomSheet>
    );
  }

  const optionClass = (selected: boolean) =>
    `w-full p-3 rounded-zine-sm border-2 flex items-center gap-3 text-left transition-colors cursor-pointer active:scale-[0.99] ${
      selected ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
    }`;
  const icon = (content: React.ReactNode) => (
    <span className="shrink-0 w-10 h-10 rounded-[12px] bg-zine-card flex items-center justify-center text-[20px] leading-none">{content}</span>
  );
  const check = (selected: boolean) => (
    <span
      aria-hidden
      className={`shrink-0 w-6 h-6 rounded-[8px] border-2 flex items-center justify-center ${
        selected ? 'bg-zine-terracotta border-zine-terracotta text-white' : 'border-zine-border bg-zine-cardElevated'
      }`}
    >
      {selected && <Check size={16} strokeWidth={3} />}
    </span>
  );

  return (
    <BottomSheet
      title={T.title}
      onClose={onClose}
      footer={
        <button
          onClick={vote}
          disabled={busy}
          className={`w-full h-12 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 cursor-pointer ${
            picked.length ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-inkMuted'
          }`}
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          {T.send(picked.length)}
        </button>
      }
    >
      <p className="text-lead font-bold text-zine-ink">{poll.question}</p>
      {poll.note && <p className="mt-1.5 text-sm2 text-zine-inkMuted">{poll.note}</p>}
      <p className="mt-2 text-cap text-zine-inkMuted">{T.pickHint}</p>

      <div className="mt-3 space-y-2">
        {poll.options.map((o) => {
          const selected = picked.includes(o.key);
          return (
            <button key={o.key} role="checkbox" aria-checked={selected} onClick={() => toggle(o.key)} className={optionClass(selected)}>
              {icon(o.emoji || '•')}
              <span className="flex-1 min-w-0 text-body font-semibold text-zine-ink">{o.label}</span>
              {check(selected)}
            </button>
          );
        })}

        {poll.allowCustom && (
          <div className={`${optionClass(isCustomOpen)} flex-col !items-stretch`}>
            <button type="button" role="checkbox" aria-checked={isCustomOpen} onClick={() => toggle(POLL_CUSTOM)} className="flex items-center gap-3 text-left cursor-pointer">
              {icon(<Pencil size={18} className="text-zine-ink" />)}
              <span className="flex-1 min-w-0 text-body font-semibold text-zine-ink">{T.custom}</span>
              {check(isCustomOpen)}
            </button>
            {isCustomOpen && (
              <>
                <textarea
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value.slice(0, CUSTOM_MAX));
                    setError(null);
                  }}
                  placeholder={T.customPlaceholder}
                  rows={3}
                  autoFocus
                  className="field mt-3 resize-none"
                />
                <div className="mt-1 text-right text-cap text-zine-inkMuted tabular-nums">
                  {custom.length}/{CUSTOM_MAX}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm2 text-zine-danger">{error}</p>}
      <p className="mt-4 text-center text-cap text-zine-inkMuted">{T.votes(poll.total)}</p>
    </BottomSheet>
  );
};
