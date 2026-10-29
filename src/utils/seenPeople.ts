import { api } from '../services/api';

/**
 * Кого уже посмотрели в «Людях»: копим и отправляем пачкой раз в несколько секунд
 * (и когда приложение сворачивают). За один запуск каждого — один раз
 */
const sent = new Set<number>();
let queue: number[] = [];
let timer: number | undefined;

const flush = () => {
  window.clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const ids = queue;
  queue = [];
  api.markPeopleSeen(ids).catch(() => {});
};

export const markPersonSeen = (telegramId: number) => {
  if (sent.has(telegramId)) return;
  sent.add(telegramId);
  queue.push(telegramId);
  if (queue.length >= 20) flush();
  else if (!timer) timer = window.setTimeout(flush, 5000);
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
