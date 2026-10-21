import React, { useState } from 'react';
import { Check, Clock, MapPin, Users, Send, Share2 } from 'lucide-react';
import { AppEvent, JoinOptions, eventCategoryOf, EVENT_TAGS, companyNote } from '../../types';
import { telegramService } from '../../services/telegram';
import { formatEventDate } from '../../screens/MapScreen';
import { ReportSheet } from './ReportSheet';
import { JoinSheet } from './JoinSheet';

/**
 * Подробности сходки: когда, где, сколько идёт, кнопки «Пойду!», «Позвать друзей» и «Организатору»
 */
// Строка «Идут: 7 из 10 · 3 компании · 👶 2»
export const eventPeopleLine = (ev: AppEvent) => {
  const groups = ev.groupsCount ?? ev.participantsCount;
  return [
    `Идут: ${ev.participantsCount || 1}${ev.maxParticipants ? ` из ${ev.maxParticipants}` : ''}`,
    groups && groups < ev.participantsCount ? `${groups} ${groups === 1 ? 'компания' : groups < 5 ? 'компании' : 'компаний'}` : '',
    ev.withKidsCount ? `👶 ${ev.withKidsCount}` : ''
  ]
    .filter(Boolean)
    .join(' · ');
};

export const EventDetails: React.FC<{
  event: AppEvent;
  // options — с кем идёшь; null — «Не пойду»
  onJoin: (options: JoinOptions | null) => Promise<unknown> | void;
  onReported?: () => void;
}> = ({ event, onJoin, onReported }) => {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const cat = eventCategoryOf(event);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const isCreator = Number(event.creator?.telegramId) === Number(telegramService.getUser()?.id);
  const isFull = !event.isJoined && Boolean(event.maxParticipants) && (event.participantsCount || 1) >= event.maxParticipants;

  return (
    <div className="space-y-3">
      {event.isOfficial && <p className="text-sm2 font-bold text-zine-terracotta">⭐ От ДА! МИНСК — приходи, тут рады новичкам</p>}
      <div className="flex flex-wrap gap-1.5">
        {cat && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold ${cat.badgeBg} ${cat.badgeText}`}>
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </span>
        )}
        {(event.tags || []).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold bg-zine-card text-zine-ink">
            {EVENT_TAGS[t].emoji} {EVENT_TAGS[t].label}
          </span>
        ))}
      </div>

      <div className="space-y-2 text-body text-zine-ink">
        <p className="flex items-center gap-2.5">
          <Clock size={20} className="text-zine-terracotta shrink-0" />
          <span className="font-semibold">{formatEventDate(event.dateTime)}</span>
        </p>
        <p className="flex items-center gap-2.5">
          <MapPin size={20} className="text-zine-terracotta shrink-0" />
          <span>{event.locationName}</span>
        </p>
        <p className="flex items-center gap-2.5 text-zine-inkMuted">
          <Users size={20} className="shrink-0" />
          <span>{eventPeopleLine(event)}</span>
        </p>
      </div>

      {event.description && <p className="text-body text-zine-ink whitespace-pre-line">{event.description}</p>}

      <div className="space-y-2 pt-2">
        <button
          onClick={() => {
            telegramService.haptic('medium');
            setIsJoinOpen(true);
          }}
          disabled={isFull}
          className={`w-full h-12 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${
            event.isJoined ? 'bg-zine-sage/15 text-zine-sage' : isFull ? 'bg-zine-card text-zine-inkMuted cursor-default' : 'bg-zine-terracotta text-white'
          }`}
        >
          {isFull ? (
            <span>Мест нет — все {event.maxParticipants} заняты</span>
          ) : event.isJoined ? (
            <>
              <Check size={20} strokeWidth={3} />
              <span>
                Я иду{companyNote(event.myGuests, event.myWithKids) ? ` (${companyNote(event.myGuests, event.myWithKids)})` : ''} · изменить
              </span>
            </>
          ) : (
            <span>Пойду!</span>
          )}
        </button>

        <div className={`grid gap-2 ${event.creator?.username ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            onClick={() => {
              telegramService.haptic('selection');
              telegramService.shareEvent(event);
            }}
            className="h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <Share2 size={20} />
            <span>Позвать друзей</span>
          </button>
          {event.creator?.username && (
            <button
              onClick={() => {
                telegramService.haptic('medium');
                telegramService.openChat(event.creator.username);
              }}
              className="h-12 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <Send size={20} />
              <span>Организатору</span>
            </button>
          )}
        </div>
      </div>

      {!isCreator && (
        <button onClick={() => setIsReportOpen(true)} className="w-full h-11 text-sm2 font-semibold text-zine-danger cursor-pointer">
          ⚠️ Пожаловаться на сходку
        </button>
      )}
      {isJoinOpen && (
        <JoinSheet event={event} onConfirm={async (o) => onJoin(o)} onLeave={async () => onJoin(null)} onClose={() => setIsJoinOpen(false)} />
      )}
      {isReportOpen && (
        <ReportSheet
          targetType="event"
          targetId={event.id}
          targetName={event.title}
          onClose={() => setIsReportOpen(false)}
          onReported={() => onReported?.()}
        />
      )}
    </div>
  );
};
