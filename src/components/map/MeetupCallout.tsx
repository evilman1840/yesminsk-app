import { AppEvent, eventCategoryOf, formatTime } from '../../types';
import { MAP_CALLOUT_TEXTS as T } from '../../texts/meetups';

/**
 * Призыв к сходкам в строке подсказок: живые данные о сходках, куда можно пойти, и «собери свою»
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

export interface MeetupCallout {
  key: string;
  text: string;
  action: string;
  event: AppEvent | null; // null — «собери свою»
}

// Очередь для строки подсказок: куда идут из «На связи» → самые подходящие мне (сервер уже отдаёт по порядку) → «собери свою».
// Показывается по одной: закрыл — следующая
export function pickMeetupCallouts(events: AppEvent[], myId: number | undefined, matchIds: number[]): MeetupCallout[] {
  // Куда можно пойти в ближайшую неделю: не свои, ещё не записан, есть места, не начались больше получаса назад
  const now = Date.now();
  const candidates = events.filter((e) => {
    const t = new Date(e.dateTime).getTime();
    const hasSeats = !e.maxParticipants || e.participantsCount < e.maxParticipants;
    return !e.isJoined && hasSeats && Number(e.creator?.telegramId) !== Number(myId) && t > now - 30 * 60 * 1000 && t < now + 7 * 24 * 3600 * 1000;
  });
  const friends = new Set(matchIds);
  const friendOf = (e: AppEvent) => e.participants?.find((p) => friends.has(Number(p.telegramId)))?.name;
  const ordered = [...candidates.filter((e) => friendOf(e)), ...candidates.filter((e) => !friendOf(e))].slice(0, 6);

  const list: MeetupCallout[] = ordered.map((e) => {
    const friend = friendOf(e);
    return {
      key: String(e.id),
      text: friend ? T.friend(friend, e.title, whenText(e.dateTime)) : T.event(eventCategoryOf(e).emoji, e.title, whenText(e.dateTime)),
      action: T.go,
      event: e
    };
  });
  return [...list, { key: 'create', text: ordered.length ? T.createOwn : T.empty, action: T.create, event: null }];
}
