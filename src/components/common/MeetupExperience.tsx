import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { attendanceBadge, attendedLabel, EXPERIENCE_TEXTS as T } from '../../texts/meetupExperience';
import { MEETUP_TEXTS as M } from '../../texts/meetups';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';

type Experience = Pick<UserProfile, 'attendedCount' | 'hostedCount' | 'hostActive' | 'isSupporter'>;
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Одна область нажатия от 44 px; цифры и подписи читаются на любом фото и в обеих темах. */
export const MeetupExperience: React.FC<{ user: Experience; className?: string; onPhoto?: boolean }> = ({ user, className = '', onPhoto = false }) => {
  const [open, setOpen] = useState(false);
  const attended = user.attendedCount || 0;
  const hosted = user.hostedCount || 0;
  if (!attended && !hosted && !user.isSupporter) return null;
  const badge = attendanceBadge(attended);
  const hostEmoji = user.hostActive ? '🔥' : '🌱';
  const label = [attended ? `${badge.emoji} ${attendedLabel(attended)}` : '', hosted ? `${hostEmoji} ${T.hosted(hosted)}` : '', user.isSupporter ? M.badgeSupporter : ''].filter(Boolean).join('. ');
  return <>
    <button
      type="button"
      data-no-swipe
      aria-label={`${label}. Подробнее о Сходках и значках`}
      onClick={(e) => { stop(e); telegramService.haptic('selection'); setOpen(true); }}
      className={`pointer-events-auto flex min-h-11 max-w-full text-left text-zine-ink cursor-pointer active:scale-[0.98] transition-transform ${onPhoto ? 'items-end rounded-full' : 'items-center rounded-2xl border border-zine-border/60 bg-zine-cardElevated/80 px-3 py-2 shadow-sm backdrop-blur-sm'} ${className}`}
    >
      <span className={`flex flex-wrap items-center gap-y-1 leading-snug ${onPhoto ? 'gap-x-2 rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[12px] font-semibold shadow-sm backdrop-blur-md dark:border-zine-border dark:bg-zine-cardElevated/85' : 'gap-x-3 text-cap font-bold'}`}>
        {attended > 0 && <span className="whitespace-nowrap"><span aria-hidden>{badge.emoji} </span>{attendedLabel(attended)}</span>}
        {hosted > 0 && <span className="whitespace-nowrap"><span aria-hidden>{hostEmoji} </span>{T.hosted(hosted)}</span>}
        {user.isSupporter && <span aria-hidden>🍩</span>}
      </span>
    </button>
    {open && <div onClick={stop} onPointerDown={stop} onPointerMove={stop} onPointerUp={stop}>
      <BottomSheet title={T.title} onClose={() => setOpen(false)}>
        {attended > 0 && <p className="text-body font-bold">{badge.emoji} {badge.label} · {attendedLabel(attended)}</p>}
        {hosted > 0 && <p className="mt-2 text-body"><b>{user.hostActive ? M.badgeActive : M.badgeStarter}</b><br />{M.hostedCount(hosted)}</p>}
        <p className="mt-4 text-sm2 text-zine-inkMuted">{T.explanation}</p>
        <p className="mt-2 text-sm2 text-zine-inkMuted">{T.includesOwn}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[1, 2, 5, 10].map((n) => { const step = attendanceBadge(n); return <div key={n} className={`rounded-zine-sm bg-zine-card p-3 ${attended >= n ? '' : 'text-zine-inkMuted'}`}>
            <p className="text-sm2 font-bold">{step.emoji} {step.label}</p><p className="mt-1 text-cap">{step.range}</p>
          </div>; })}
        </div>
        {hosted > 0 && <p className="mt-4 text-sm2 text-zine-inkMuted">{user.hostActive ? M.badgeActiveText : M.badgeStarterText}</p>}
        {user.isSupporter && <p className="mt-4 text-sm2"><b>{M.badgeSupporter}</b><br />{M.badgeSupporterText}</p>}
        <p className="mt-4 text-cap text-zine-inkMuted">{T.refreshed}</p>
      </BottomSheet>
    </div>}
  </>;
};
