import { AppEvent, eventCategoryOf, formatTime } from '../../types';
import { MAP_CALLOUT_TEXTS as T } from '../../texts/meetups';

/**
 * Призыв к сходкам (в строке подсказок) — одна строка с живыми данными:
 * знакомый из «На связи» идёт на сходку → ближайшая подходящая сходка → «собери свою».
 * Сходки приходят с сервера уже по порядку «насколько подходит человеку»
 */

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

// Что сказать: знакомый идёт → ближайшая подходящая сходка → «собери свою»
export function pickMeetupCallout(events: AppEvent[], myId: number | undefined, matchIds: number[]) {
  // Куда можно пойти в ближайшие двое суток: не свои, ещё не записан, не начались больше получаса назад
  const now = Date.now();
  const candidates = events.filter((e) => {
    const t = new Date(e.dateTime).getTime();
    return !e.isJoined && Number(e.creator?.telegramId) !== Number(myId) && t > now - 30 * 60 * 1000 && t < now + 48 * 3600 * 1000;
  });
  const friends = new Set(matchIds);
  const withFriend = candidates.find((e) => e.participants?.some((p) => friends.has(Number(p.telegramId))));
  const friendName = withFriend?.participants?.find((p) => friends.has(Number(p.telegramId)))?.name;
  const event = withFriend || candidates[0] || null;
  const todayCount = candidates.filter((e) => new Date(e.dateTime).toDateString() === new Date().toDateString()).length;

  const text = withFriend && friendName
    ? T.friend(friendName, withFriend.title, whenText(withFriend.dateTime))
    : event
    ? T.event(eventCategoryOf(event).emoji, todayCount, event.title, whenText(event.dateTime))
    : T.empty;
  return { text, action: event ? T.go : T.create, event };
}
