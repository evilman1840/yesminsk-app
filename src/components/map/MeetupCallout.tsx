import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AppEvent, eventCategoryOf, formatTime } from '../../types';
import { telegramService } from '../../services/telegram';
import { MAP_CALLOUT_TEXTS as T } from '../../texts/meetups';

/**
 * Призыв к сходкам на карте — одна строка с живыми данными:
 * знакомый из «На связи» идёт на сходку → ближайшая подходящая сходка → «собери свою».
 * Сходки приходят с сервера уже по порядку «насколько подходит человеку»
 */

const CLOSED_KEY = 'yesminsk_map_callout_closed';
const today = () => new Date().toDateString();

const isClosedToday = () => {
  try {
    return localStorage.getItem(CLOSED_KEY) === today();
  } catch {
    return false;
  }
};

// «сегодня в 19:00», «завтра в 12:00», «в субботу в 11:00»
export function whenText(iso: string) {
  const d = new Date(iso);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - start.getTime()) / 86400000);
  const time = formatTime(iso);
  if (diff <= 0) return `${T.today} ${time}`;
  if (diff === 1) return `${T.tomorrow} ${time}`;
  return `${T.weekday[d.getDay()]} ${time}`;
}

export const MeetupCallout: React.FC<{
  events: AppEvent[];
  myId?: number;
  matchIds: number[];
  onOpenEvent: (event: AppEvent) => void;
  onCreate: () => void;
}> = ({ events, myId, matchIds, onOpenEvent, onCreate }) => {
  const [isClosed, setIsClosed] = useState(isClosedToday);
  if (isClosed) return null;

  // Куда можно пойти в ближайшие двое суток: не свои, ещё не записан, не начались больше получаса назад
  const now = Date.now();
  const candidates = events.filter((e) => {
    const t = new Date(e.dateTime).getTime();
    return !e.isJoined && Number(e.creator?.telegramId) !== Number(myId) && t > now - 30 * 60 * 1000 && t < now + 48 * 3600 * 1000;
  });
  const friends = new Set(matchIds);
  const withFriend = candidates.find((e) => e.participants?.some((p) => friends.has(Number(p.telegramId))));
  const friendName = withFriend?.participants?.find((p) => friends.has(Number(p.telegramId)))?.name;
  const event = withFriend || candidates[0];
  const todayCount = candidates.filter((e) => new Date(e.dateTime).toDateString() === today()).length;

  const text = withFriend && friendName
    ? T.friend(friendName, withFriend.title, whenText(withFriend.dateTime))
    : event
    ? T.event(eventCategoryOf(event).emoji, todayCount, event.title, whenText(event.dateTime))
    : T.empty;

  return (
    <div className="w-full max-w-[340px] pl-4 pr-1 py-1 rounded-zine bg-zine-cardElevated text-zine-ink shadow-zine-float flex items-center gap-1">
      <button
        onClick={() => {
          telegramService.haptic('selection');
          if (event) onOpenEvent(event);
          else onCreate();
        }}
        className="min-w-0 flex-1 py-2 text-left text-sm2 leading-snug cursor-pointer"
      >
        {text} <span className="font-bold text-zine-terracotta whitespace-nowrap">{event ? T.go : T.create}</span>
      </button>
      <button
        onClick={() => {
          telegramService.haptic('selection');
          try {
            localStorage.setItem(CLOSED_KEY, today());
          } catch {
            // не запомнили — просто скроем до перезапуска
          }
          setIsClosed(true);
        }}
        aria-label={T.close}
        className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-zine-inkMuted cursor-pointer"
      >
        <X size={18} />
      </button>
    </div>
  );
};
