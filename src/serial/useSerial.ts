import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { EPISODES, SerialEpisode } from './episodes';

export type SerialSource = 'intro' | 'joy' | 'strip' | 'shelf' | 'tv' | 'next' | 'link' | 'notice';
type Seen = Record<number, { maxFrame: number; frames: number; liked: boolean; answer?: string; wished?: boolean }>;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* приватный режим */
    }
  }
};

// Локально видно все серии сразу — чтобы проверять до выхода
// Админу — тоже: тестирует серии до выхода
const PREVIEW = import.meta.env.DEV || store.get('serial_preview') === '1';
let adminPreview = false;
export const isReleased = (ep: SerialEpisode, now = Date.now()) => PREVIEW || adminPreview || new Date(ep.releaseAt).getTime() <= now;

// «сегодня», «завтра» или «в четверг» — по Минску; withTime добавляет «в 10:00»
const DAYS = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
const minskDay = (t: number) => Math.floor((t + 3 * 3600 * 1000) / 86400000);
export const dayLabel = (t: number, withTime = false) => {
  const diff = minskDay(t) - minskDay(Date.now());
  const day = diff <= 0 ? 'сегодня' : diff === 1 ? 'завтра' : DAYS[new Date(t + 3 * 3600 * 1000).getUTCDay()];
  return withTime ? `${day} в 10:00` : day;
};
export const releaseDay = (ep: SerialEpisode, withTime = false) => dayLabel(new Date(ep.releaseAt).getTime(), withTime);

/**
 * Состояние сериала: какие серии вышли, какие я открывал, сердечки.
 * «Ждёт» — самая ранняя вышедшая серия, которую я ещё не открывал: её зовёт плашка и «момент радости»
 */
export function useSerial(enabled: boolean, preview = false) {
  adminPreview = preview;
  const [seen, setSeen] = useState<Seen>({});
  const [hearts, setHearts] = useState<Record<number, number>>({});
  const [answers, setAnswers] = useState<Record<number, Record<string, number>>>({});
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return;
    api
      .getSerial()
      .then((r) => {
        setSeen(r.seen || {});
        setHearts(r.hearts || {});
        setAnswers(r.answers || {});
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    // Серия выходит в 10:00 — пересчитываем раз в 10 минут
    const t = setInterval(() => setNow(Date.now()), 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [enabled]);

  const released = useMemo(() => EPISODES.filter((e) => isReleased(e, now)), [now, preview]);
  const upcoming = useMemo(() => EPISODES.find((e) => !isReleased(e, now)) || null, [now, preview]);
  const waiting = loaded ? released.find((e) => !seen[e.n]) || null : null;

  const markOpened = useCallback((n: number) => {
    setSeen((s) => (s[n] ? s : { ...s, [n]: { maxFrame: 0, frames: 0, liked: false } }));
  }, []);

  const setLiked = useCallback(async (n: number, liked: boolean) => {
    setSeen((s) => ({ ...s, [n]: { ...(s[n] || { maxFrame: 0, frames: 0 }), liked } }));
    setHearts((h) => ({ ...h, [n]: Math.max(0, (h[n] || 0) + (liked ? 1 : -1)) }));
    const r = await api.serialLike(n, liked).catch(() => null);
    if (r) setHearts((h) => ({ ...h, [n]: r.hearts }));
  }, []);

  // Вопрос в конце серии: сразу показываем мой ответ, потом — проценты с сервера
  const answer = useCallback(async (n: number, option: string) => {
    setSeen((s) => ({ ...s, [n]: { ...(s[n] || { maxFrame: 0, frames: 0, liked: false }), answer: s[n]?.answer || option } }));
    setAnswers((a) => ({ ...a, [n]: { ...(a[n] || {}), [option]: ((a[n] || {})[option] || 0) + 1 } }));
    const r = await api.serialAnswer(n, option).catch(() => null);
    if (r) {
      setAnswers((a) => ({ ...a, [n]: r.answers }));
      setSeen((s) => ({ ...s, [n]: { ...(s[n] || { maxFrame: 0, frames: 0, liked: false }), answer: r.answer } }));
    }
  }, []);
  const markWished = useCallback((n: number) => {
    setSeen((s) => ({ ...s, [n]: { ...(s[n] || { maxFrame: 0, frames: 0, liked: false }), wished: true } }));
    api.serialWished(n).catch(() => {});
  }, []);

  // Плашка: ✕ прячет её до следующей серии
  const [stripHidden, setStripHidden] = useState(() => store.get('serial_strip_hidden') || '');
  const hideStrip = (n: number) => {
    store.set('serial_strip_hidden', String(n));
    setStripHidden(String(n));
  };
  const showStrip = !!waiting && stripHidden !== String(waiting.n);

  // «Момент радости» (опубликовал сходку, взаимное 👋): раньше серия открывалась сама поверх экрана —
  // так её закрывали сразу (12 из 16 ушли на обложке). Теперь только возвращаем плашку, если её скрыли. Один раз на серию
  const takeJoy = (): SerialEpisode | null => {
    if (!waiting || store.get(`serial_joy_${waiting.n}`)) return null;
    store.set(`serial_joy_${waiting.n}`, '1');
    if (stripHidden === String(waiting.n)) {
      store.set('serial_strip_hidden', '');
      setStripHidden('');
    }
    return waiting;
  };

  return { seen, hearts, answers, released, upcoming, waiting, markOpened, setLiked, answer, markWished, showStrip, hideStrip, takeJoy };
}

export type SerialState = ReturnType<typeof useSerial>;
