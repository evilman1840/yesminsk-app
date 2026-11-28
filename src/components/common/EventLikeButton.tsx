import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { AppEvent } from '../../types';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { EVENT_UPDATED } from '../../context/eventUpdates';

type LikeState = Pick<AppEvent, 'id' | 'isLiked' | 'likesCount'>;
const pending = new Set<string>();

export const EventLikeButton: React.FC<{ event: AppEvent }> = ({ event }) => {
  const [local, setLocal] = useState<LikeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => setLocal(null), [event.id, event.isLiked, event.likesCount]);
  useEffect(() => {
    const update = (message: Event) => {
      const next = (message as CustomEvent<LikeState>).detail;
      if (next.id === event.id && typeof next.isLiked === 'boolean') setLocal(next);
    };
    window.addEventListener(EVENT_UPDATED, update);
    return () => window.removeEventListener(EVENT_UPDATED, update);
  }, [event.id]);
  const state = local?.id === event.id ? local : event;
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pending.has(event.id)) return;
    pending.add(event.id);
    setBusy(true);
    telegramService.haptic('light');
    try {
      const result = await api.setEventLike(event.id, !state.isLiked);
      window.dispatchEvent(new CustomEvent<LikeState>(EVENT_UPDATED, { detail: { id: event.id, ...result } }));
      if (mounted.current && result.isLiked) setBurst(n => n + 1);
      telegramService.haptic('success');
    } catch {
      toast.error('Лайк не сохранился. Нажми на сердечко ещё раз');
      telegramService.haptic('error');
    } finally {
      pending.delete(event.id);
      if (mounted.current) setBusy(false);
    }
  };
  const count = state.likesCount || 0;
  return <button type="button" onClick={toggle} disabled={busy} aria-busy={busy} aria-pressed={Boolean(state.isLiked)}
    aria-label={count > 0 ? `${state.isLiked ? 'Убрать лайк' : 'Нравится'}. Лайков: ${count}` : (state.isLiked ? 'Убрать лайк' : 'Нравится')}
    className={`relative shrink-0 w-14 ${count > 0 ? 'min-h-[64px]' : 'h-14'} rounded-full flex flex-col items-center justify-center gap-0.5 border shadow-sm active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta ${state.isLiked ? 'bg-zine-terracotta text-white border-zine-terracotta' : 'bg-zine-paper text-zine-terracotta border-zine-border'} ${busy ? 'opacity-60' : ''}`}>
    <span key={burst} className={`relative flex items-center justify-center ${burst ? 'event-like-pop' : ''}`}>
      <Heart size={27} strokeWidth={2.3} fill={state.isLiked ? 'currentColor' : 'none'} />
      {burst > 0 && Array.from({ length: 6 }, (_, i) => <i key={i} aria-hidden className="event-like-spark" style={{ '--spark-x': `${Math.cos(i * Math.PI / 3) * 33}px`, '--spark-y': `${Math.sin(i * Math.PI / 3) * 33}px` } as React.CSSProperties} />)}
    </span>
    {count > 0 && <span className="text-[13px] leading-4 font-bold tabular-nums" aria-hidden>{count}</span>}
  </button>;
};
