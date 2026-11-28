import React from 'react';
import { MapPin, Check } from 'lucide-react';
import { AppEvent, eventCategoryOf, isGathering, isUnclaimedExternal } from '../../types';
import { telegramService } from '../../services/telegram';
import { thumb } from '../../utils/thumb';
import { formatDistance } from '../common/UserBottomSheet';
import { whenText } from './MeetupCallout';
import { MAP_EVENTS_TEXTS as T, MEETUP_TEXTS as M } from '../../texts/meetups';

/**
 * Сходки на карте списком — вместо кружочков. Порядок тот же, что в ленте «Сходки» (по тому, насколько подходит).
 * Нажатие открывает сходку в той же шторке, что и кружок на карте
 */
export const MapEventsList: React.FC<{
  events: AppEvent[];
  topClass: string;
  onOpen: (event: AppEvent) => void;
  empty?: React.ReactNode;
}> = ({ events, topClass, onOpen, empty }) => (
  <div className={`absolute inset-x-0 bottom-0 ${topClass} z-[25] rounded-t-zine bg-zine-paper shadow-zine-float overflow-y-auto overscroll-contain`}>
    <div className="px-4 pt-3 pb-24 space-y-2.5">
      {events.length === 0
        ? empty
        : events.map((ev) => {
            const cat = eventCategoryOf(ev);
            const unclaimedExt = isUnclaimedExternal(ev);
            const people = (ev.participants?.length ? ev.participants : unclaimedExt ? [] : [ev.creator]).slice(0, 4);
            const distance = formatDistance(ev.distanceMeters);
            return (
              <button
                key={ev.id}
                onClick={() => {
                  telegramService.haptic('selection');
                  onOpen(ev);
                }}
                className={`w-full p-3.5 rounded-zine text-left flex gap-3 active:scale-[0.99] transition-transform cursor-pointer ${
                  unclaimedExt
                    ? 'bg-zine-mustard/10 border-2 border-dashed border-zine-mustard/75 shadow-zine-sm'
                    : 'bg-zine-cardElevated border border-zine-border'
                }`}
              >
                <span
                  className={`relative w-12 h-12 shrink-0 rounded-zine-sm flex items-center justify-center text-[26px] leading-none ${
                    unclaimedExt ? 'bg-zine-mustard/25 border border-zine-mustard/50' : 'bg-zine-card'
                  }`}
                  aria-hidden
                >
                  {cat.emoji}
                  {unclaimedExt && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zine-ink text-zine-paper text-[11px] font-extrabold flex items-center justify-center">
                      @
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-cap font-semibold text-zine-terracotta first-letter:uppercase">{whenText(ev.dateTime)}</span>
                    {unclaimedExt && (
                      <span className="px-2 py-0.5 rounded-full bg-zine-mustard/25 text-zine-mustardInk text-[11px] font-bold leading-tight">
                        {M.externalFilterChip}
                      </span>
                    )}
                  </span>
                  <span className="block font-serif font-bold text-body text-zine-ink leading-snug line-clamp-2">{ev.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm2 text-zine-inkMuted">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate">{ev.locationName}</span>
                    {distance && <span className="shrink-0">· {distance}</span>}
                  </span>
                  <span className="mt-2 flex items-center gap-2">
                    {people.length > 0 && (
                      <span className="flex -space-x-2 shrink-0">
                        {people.map((p, i) => (
                          <img key={`${p?.telegramId}-${i}`} src={thumb(p?.avatarUrl)} alt="" loading="lazy" className="w-6 h-6 rounded-full object-cover border-2 border-zine-cardElevated" />
                        ))}
                      </span>
                    )}
                    <span className="text-cap text-zine-inkMuted truncate">
                      {unclaimedExt
                        ? ev.participantsCount
                          ? `${M.externalSource(ev.external?.authorHandle, ev.external?.authorName)} · идут ${ev.participantsCount}`
                          : M.externalSource(ev.external?.authorHandle, ev.external?.authorName)
                        : isGathering(ev)
                          ? M.gathering(ev.participantsCount || 1)
                          : T.going(ev.participantsCount || 1, ev.maxParticipants)}
                    </span>
                    {ev.isJoined && (
                      <span className="ml-auto h-6 px-2 rounded-full bg-zine-sage text-white text-cap font-bold flex items-center gap-1 whitespace-nowrap">
                        <Check size={13} strokeWidth={3} /> {T.joined}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
    </div>
  </div>
);
