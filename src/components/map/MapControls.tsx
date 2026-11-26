import { Heart, LocateFixed } from 'lucide-react';
import { thumb, NO_PHOTO } from '../../utils/thumb';

export function MapStatusButton({ avatarUrl, active, unread, pulse, onOpen }: {
  avatarUrl?: string;
  active: boolean;
  unread: number;
  pulse: boolean;
  onOpen: () => void;
}) {
  return <button type="button" onClick={onOpen}
    aria-label={unread ? `Я сейчас и уведомления, новых: ${unread}` : 'Я сейчас: изменить статус'}
    className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-zine-terracotta bg-zine-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zine-terracotta">
    {pulse && <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full border-2 border-zine-terracotta motion-safe:animate-ping [animation-duration:1.7s] [animation-iteration-count:3]" />}
    <img src={thumb(avatarUrl) || NO_PHOTO} alt="" className="h-full w-full rounded-full object-cover" />
    {unread > 0 && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-zine-terracotta ring-2 ring-zine-paper" />}
    <span className={`absolute -bottom-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shadow-zine-sm ${active ? 'bg-zine-terracotta text-white' : 'bg-zine-ink text-zine-paper'}`}>Я сейчас</span>
  </button>;
}

export function MapQuickControls({ onDonate, onLocate, locating }: {
  onDonate?: () => void;
  onLocate: () => void;
  locating: boolean;
}) {
  return <div className="absolute bottom-14 right-4 z-20 flex flex-col gap-0.5 rounded-[26px] border border-zine-paper/90 bg-zine-ink p-1.5 text-zine-paper shadow-zine-float">
    {onDonate && <>
      <button type="button" onClick={onDonate} aria-label="Донат проекту"
        className="flex min-h-[52px] w-12 flex-col items-center justify-center gap-0.5 rounded-[19px] bg-zine-paper font-bold text-zine-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">
        <Heart size={22} aria-hidden className="fill-zine-terracotta text-zine-terracotta" />
        <span className="text-[11px] leading-4">Донат</span>
      </button>
      <span aria-hidden className="mx-2 h-px bg-zine-paper/20" />
    </>}
    <button type="button" onClick={onLocate} disabled={locating} title="Где я?" aria-label="Показать, где я" aria-busy={locating}
      className="grid h-11 w-12 place-items-center rounded-[19px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-paper disabled:opacity-60">
      <LocateFixed size={24} className={locating ? 'motion-safe:animate-spin' : ''} />
    </button>
  </div>;
}
