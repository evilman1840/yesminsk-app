import type { AppEvent } from '../types';

/**
 * Окно «Донат для ГУЛЯЙ» организатору сходки с оплатой ему (payTo: host).
 * Показываем один раз на сходку и не чаще раза в неделю: сразу после публикации
 * или при входе в приложение, если сходку отметили «Мне» позже (руками в базе, через «Изменить»).
 * Хранится в браузере: на другом телефоне окно может показаться ещё раз — не страшно.
 */
const WEEK_KEY = 'yesminsk_host_donate_at';
const SEEN_KEY = 'yesminsk_host_donate_seen';
const WEEK = 7 * 24 * 3600 * 1000;

const readSeen = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

// Эти сходки больше не повод показывать окно
export const markHostDonateSeen = (ids: string[]) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), ...ids])].slice(-100)));
  } catch {
    // хранилище недоступно — ничего страшного
  }
};

// Прошла неделя с прошлого показа? Если да — запоминаем показ сейчас
export const takeHostDonateTurn = () => {
  try {
    if (Date.now() - Number(localStorage.getItem(WEEK_KEY) || 0) < WEEK) return false;
    localStorage.setItem(WEEK_KEY, String(Date.now()));
  } catch {
    // хранилище недоступно — просто покажем
  }
  return true;
};

// Мои будущие сходки с оплатой мне, по которым окно ещё не показывали
export const unseenHostEvents = (events: AppEvent[], myId?: number) => {
  if (!myId) return [];
  const seen = readSeen();
  const now = Date.now();
  return events.filter(
    (e) => e.creator?.telegramId === myId && e.isPaid && e.payTo === 'host' && new Date(e.dateTime).getTime() > now && !seen.includes(String(e.id))
  );
};
