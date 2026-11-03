import React from 'react';
import { AppEvent, WishSummaryItem, CUSTOM_TEMPLATE } from '../../types';
import { DELICATE_KINDS } from '../common/WishSheet';
import { PEOPLE_MEETUP_TEXTS as T } from '../../texts/feed';
import { WISH_TEXTS } from '../../texts/wishes';

/**
 * Сходки между анкетами в «Людях»: одна подходящая сходка (идут те, кого листаешь), а нет такой — «Собери свою».
 * Чтобы не напрягало: «Неинтересно» дважды подряд — пауза на 3 дня
 */

const DAY = 24 * 60 * 60 * 1000;
const HIDES_KEY = 'yesminsk_people_meetup_hides';
const PAUSE_KEY = 'yesminsk_people_meetup_pause';

const readNum = (key: string) => {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};
const writeNum = (key: string, n: number) => {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // не страшно: правило сработает до перезапуска
  }
};

export const peopleMeetupsAllowed = () => readNum(PAUSE_KEY) < Date.now();

// «Неинтересно» на сходке в ленте: второе подряд — сходки в «Людях» уходят на 3 дня
export const notePeopleMeetupHidden = () => {
  const hides = readNum(HIDES_KEY) + 1;
  if (hides >= 2) {
    writeNum(PAUSE_KEY, Date.now() + 3 * DAY);
    writeNum(HIDES_KEY, 0);
  } else writeNum(HIDES_KEY, hides);
};
export const notePeopleMeetupJoined = () => writeNum(HIDES_KEY, 0);

// После 7-й анкеты и дальше каждые 8, но не вплотную к «Договоримся?» и «Хочу сходить»
export const isMeetupSlot = (i: number, isTaken: (i: number) => boolean) =>
  i >= 6 && (i - 6) % 8 === 0 && !isTaken(i - 1) && !isTaken(i) && !isTaken(i + 1);

/**
 * Куда позвать: ближайшие 3 дня, есть места, не своя, ещё не записан(а).
 * Сначала те, куда идут люди «На связи» или кому я передал 👋, дальше — как отсортировал сервер (подходящие мне выше)
 */
export function pickPeopleMeetups(events: AppEvent[], myId: number | undefined, friendIds: Set<number>, max = 6): AppEvent[] {
  const now = Date.now();
  const fits = events.filter((e) => {
    const t = new Date(e.dateTime).getTime();
    const hasSeats = !e.maxParticipants || (e.participantsCount || 1) < e.maxParticipants;
    return !e.isJoined && hasSeats && Number(e.creator?.telegramId) !== Number(myId) && t > now && t < now + 3 * DAY;
  });
  const withFriends = (e: AppEvent) => (e.participants || []).some((p) => friendIds.has(Number(p.telegramId)));
  return [...fits.filter(withFriends), ...fits.filter((e) => !withFriends(e))].slice(0, max);
}

// «Собери свою»: самое популярное желание, которое можно собрать по шаблону («поныть» и «своё» — нет)
export const pickCreateWish = (summary: WishSummaryItem[]) =>
  summary
    .filter((w) => !DELICATE_KINDS.includes(w.kind) && w.kind !== CUSTOM_TEMPLATE && w.count - (w.includesMe ? 1 : 0) > 0)
    .sort((a, b) => b.count - a.count)[0] || null;

export const CreateMeetupReel: React.FC<{ wish: WishSummaryItem | null; onCreate: (kind?: string) => void }> = ({ wish, onCreate }) => {
  const others = wish ? wish.count - (wish.includesMe ? 1 : 0) : 0;
  return (
    <section className="h-full w-full snap-start snap-always p-3">
      <div className="reel-night h-full rounded-zine bg-zine-paper shadow-zine-float flex flex-col items-center justify-center text-center px-6 text-zine-ink">
        <div className="text-[56px] leading-none mb-4" aria-hidden>
          🛠
        </div>
        <p className="font-serif font-bold text-title">{T.createTitle}</p>
        <p className="mt-2 text-body text-zine-inkMuted">{wish ? T.createWish(WISH_TEXTS.barCounter(others, wish.what, wish.when)) : T.createText}</p>
        <p className="mt-4 max-w-[280px] text-sm2 text-zine-inkMuted">{T.createHint}</p>
        <button
          onClick={() => onCreate(wish?.kind)}
          className="mt-6 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold active:scale-95 transition-transform cursor-pointer"
        >
          {T.createButton}
        </button>
      </div>
    </section>
  );
};
