import React, { useState } from 'react';
import { Check, Clock, MapPin, Users, Send, Share2, Navigation } from 'lucide-react';
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

  const [lat, lng] = event.coordinates || [0, 0];
  const routeUrl = `https://yandex.by/maps/?rtext=~${lat},${lng}&rtt=pd`;
  const myNote = companyNote(event.myGuests, event.myWithKids);

  return (
    <div>
      {event.isOfficial && <p className="text-sm2 font-bold text-zine-terracotta">⭐ От ДА! МИНСК — тут рады новичкам</p>}

      {/* Категория и пометки */}
      <div className={`${event.isOfficial ? 'mt-2' : ''} flex flex-wrap gap-1.5`}>
        {cat && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold ${cat.badgeBg} ${cat.badgeText}`}>
            {cat.emoji} {cat.label}
          </span>
        )}
        {(event.tags || []).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold bg-zine-card text-zine-ink">
            {EVENT_TAGS[t].emoji} {EVENT_TAGS[t].label}
          </span>
        ))}
      </div>

      {/* Когда, где, кто идёт — одним списком */}
      <div className="mt-4 rounded-zine border border-zine-border divide-y divide-zine-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Clock size={19} className="shrink-0 text-zine-terracotta" />
          <span className="text-body font-semibold text-zine-ink">{formatEventDate(event.dateTime)}</span>
        </div>
        <button onClick={() => lat && telegramService.openLink(routeUrl)} className="w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer">
          <MapPin size={19} className="shrink-0 text-zine-terracotta" />
          <span className="min-w-0 text-body text-zine-ink underline decoration-zine-border underline-offset-4">{event.locationName}</span>
        </button>
        <div className="px-4 py-3 flex items-center gap-3">
          <Users size={19} className="shrink-0 text-zine-terracotta" />
          <span className="text-body text-zine-ink">{eventPeopleLine(event)}</span>
        </div>
      </div>

      {event.description && <p className="mt-4 text-body text-zine-ink whitespace-pre-line">{event.description}</p>}

      {/* Главное действие */}
      <button
        onClick={() => {
          telegramService.haptic('medium');
          setIsJoinOpen(true);
        }}
        disabled={isFull || isCreator}
        className={`mt-5 w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${
          isCreator
            ? 'bg-zine-card text-zine-inkMuted cursor-default'
            : event.isJoined
            ? 'bg-zine-sage/15 text-zine-sage'
            : isFull
            ? 'bg-zine-card text-zine-inkMuted cursor-default'
            : 'bg-zine-terracotta text-white'
        }`}
      >
        {isCreator ? (
          <span>Ты собираешь эту сходку</span>
        ) : isFull ? (
          <span>Мест нет — все {event.maxParticipants} заняты</span>
        ) : event.isJoined ? (
          <>
            <Check size={22} strokeWidth={3} />
            <span>Я иду{myNote ? ` (${myNote})` : ''} · изменить</span>
          </>
        ) : (
          <span>Пойду!</span>
        )}
      </button>

      {/* Остальное — одним рядом */}
      <div className={`mt-2 grid gap-2 ${event.creator?.username ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <SmallAction
          onClick={() => {
            telegramService.haptic('selection');
            telegramService.shareEvent(event);
          }}
          icon={<Share2 size={20} />}
          label="Позвать"
        />
        <SmallAction onClick={() => telegramService.openLink(routeUrl)} icon={<Navigation size={20} />} label="Маршрут" />
        {event.creator?.username && (
          <SmallAction
            onClick={() => {
              telegramService.haptic('medium');
              telegramService.openChat(event.creator.username);
            }}
            icon={<Send size={20} />}
            label="Организатору"
          />
        )}
      </div>

      {!isCreator && (
        <button onClick={() => setIsReportOpen(true)} className="mt-3 w-full h-10 text-sm2 text-zine-inkMuted cursor-pointer">
          Пожаловаться на сходку
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

const SmallAction: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="h-[64px] rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-transform cursor-pointer"
  >
    {icon}
    <span>{label}</span>
  </button>
);
