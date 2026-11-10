import { useEffect, useRef, useState } from 'react';

const MUTE_KEY = 'serial-muted';
const GAP = 350; // пауза между репликами в одном кадре, мс

// По умолчанию звук выключен (смотрят и в метро, и на работе) — включают сами, выбор запоминаем
const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) !== '0';
  } catch {
    return true;
  }
};

/**
 * Озвучка кадра: реплики играют по очереди, пауза плеера ставит на паузу и звук.
 * Все файлы серии грузятся заранее, чтобы следующий кадр заговорил сразу.
 * Если WebView не дал включить звук без нажатия — blocked, и любой тап по кадру пробует снова (retry)
 */
export function useFrameAudio(all: string[], srcs: string[] | undefined, key: string, paused: boolean) {
  const [muted, setMutedState] = useState(readMuted);
  const [blocked, setBlocked] = useState(false);
  const cache = useRef(new Map<string, HTMLAudioElement>());
  const queue = useRef<{ list: string[]; i: number; gapTimer: number; inGap: boolean }>({ list: [], i: 0, gapTimer: 0, inGap: false });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const url = (s: string) => `${import.meta.env.BASE_URL}serial/${s}`;
  const el = (s: string) => {
    let a = cache.current.get(s);
    if (!a) {
      a = new Audio(url(s));
      a.preload = 'auto';
      cache.current.set(s, a);
    }
    return a;
  };

  // Вся серия — заранее
  useEffect(() => {
    all.forEach(el);
    const c = cache.current;
    return () => {
      c.forEach((a) => {
        a.pause();
        a.onended = null;
      });
    };
  }, [all.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopAll = () => {
    window.clearTimeout(queue.current.gapTimer);
    queue.current.inGap = false;
    cache.current.forEach((a) => {
      a.onended = null;
      a.pause();
    });
  };

  const playCurrent = () => {
    const q = queue.current;
    const s = q.list[q.i];
    if (!s) return;
    const a = el(s);
    a.onended = () => {
      q.i += 1;
      if (q.i >= q.list.length) return;
      q.inGap = true;
      q.gapTimer = window.setTimeout(() => {
        q.inGap = false;
        if (!pausedRef.current) playCurrent();
      }, GAP);
    };
    a.play().then(
      () => setBlocked(false),
      (e: DOMException) => {
        if (e?.name === 'NotAllowedError') setBlocked(true);
      }
    );
  };

  // Новый кадр — реплики с начала
  useEffect(() => {
    stopAll();
    const list = muted || !srcs ? [] : srcs;
    queue.current.list = list;
    queue.current.i = 0;
    list.forEach((s) => (el(s).currentTime = 0));
    if (list.length && !pausedRef.current) playCurrent();
    return stopAll;
  }, [key, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Пауза плеера — пауза звука, потом с того же места
  useEffect(() => {
    const q = queue.current;
    const s = q.list[q.i];
    if (!s) return;
    if (paused) {
      window.clearTimeout(q.gapTimer);
      el(s).pause();
    } else if (q.inGap) {
      q.inGap = false;
      playCurrent();
    } else if (el(s).paused && !el(s).ended) playCurrent();
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMuted = (m: boolean) => {
    setMutedState(m);
    setBlocked(false);
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* без памяти — не страшно */
    }
  };

  // Тап по кадру, когда звук не пустили: пробуем ещё раз уже из жеста
  const retry = () => {
    if (!blocked || muted || pausedRef.current) return;
    playCurrent();
  };

  return { muted, setMuted, blocked, retry };
}
