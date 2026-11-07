import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Дневной лимит 👋: сколько осталось на сегодня (считает сервер, приходит в /users/me и в ответе на 👋).
 * После полуночи по Минску (resetAt) кнопка возвращается сама — до свежих данных считаем, что 👋 есть.
 */
export interface WaveQuota {
  limit: number;
  left: number;
  resetAt: string;
}

let quota: WaveQuota | null = null;
let openMeetupsFn: () => void = () => {};
const listeners = new Set<() => void>();

export function setWaveQuota(next: WaveQuota | null | undefined) {
  if (!next || typeof next.left !== 'number') return;
  quota = next;
  listeners.forEach((l) => l());
}

// «Смотреть сходки» — App подставляет переход на вкладку «Сходки»
export const setOpenMeetups = (fn: () => void) => (openMeetupsFn = fn);
export const openMeetups = () => openMeetupsFn();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Сколько 👋 осталось на сегодня; null — неизвестно или наступил новый день */
export function useWavesLeft(): number | null {
  const q = useSyncExternalStore(subscribe, () => quota);
  const [, tick] = useState(0);
  const resetAt = q ? new Date(q.resetAt).getTime() : 0;
  // В полночь по Минску перерисоваться, чтобы кнопка 👋 вернулась
  useEffect(() => {
    const wait = resetAt - Date.now();
    if (!q || wait <= 0 || wait > 2 ** 31 - 1) return;
    const t = setTimeout(() => tick((n) => n + 1), wait + 1000);
    return () => clearTimeout(t);
  }, [q, resetAt]);
  if (!q || Date.now() >= resetAt) return null;
  return q.left;
}
