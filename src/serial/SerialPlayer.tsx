import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, VolumeX } from 'lucide-react';
import { api } from '../services/api';
import { telegramService } from '../services/telegram';
import { useBackButton } from '../hooks/useTelegram';
import { EPISODES, SerialEpisode, SerialTry, SERIAL_TOTAL } from './episodes';
import { TvArt } from './SerialBits';
import { useFrameAudio } from './useFrameAudio';
import { dayLabel, isReleased, releaseDay, SerialSource, SerialState } from './useSerial';

/**
 * Серия как сторис: полоски сверху, тап справа — дальше, слева — назад, в центре — пауза/дальше смотреть, кадры идут сами.
 * Последний кадр — сердечко и следующая серия. Каждый новый кадр уходит в статистику
 */
export const SerialPlayer: React.FC<{
  ep: SerialEpisode;
  source: SerialSource;
  serial: SerialState;
  startFrame?: number; // вернулся после «Попробовать» — с кадра, где остановился
  onClose: () => void;
  onTry: (to: SerialTry['to'], nextFrame: number) => void;
  onOpen: (ep: SerialEpisode, source: SerialSource) => void;
}> = ({ ep, source, serial, startFrame = 0, onClose, onTry, onOpen }) => {
  const total = ep.frames.length + 1; // + кадр с сердечком
  const [cur, setCur] = useState(startFrame);
  const [progress, setProgress] = useState(0);
  const [pop, setPop] = useState(false);
  const maxSent = useRef(-1);
  // Пауза: тап по центру кадра (ещё тап — смотреть дальше), удержание пальца (как в сторис) или свёрнутое приложение
  const [pausedTap, setPausedTap] = useState(false);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  const paused = pausedTap || held || hidden;
  const elapsed = useRef(0);
  const holdTimer = useRef(0);
  const holdUsed = useRef(false);
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const next = EPISODES.find((e) => e.n === ep.n + 1) || null;
  const nextOpen = next && isReleased(next);
  // Конец первой серии: где теперь сериал и новости, и когда выйдет следующая (без учёта админского предпросмотра)
  const tvHint = ep.n === 1;
  const nextSoon = !!next && new Date(next.releaseAt).getTime() > Date.now();
  const liked = !!serial.seen[ep.n]?.liked;
  const hearts = serial.hearts[ep.n] || 0;

  useBackButton(onClose);

  // Новая серия — с обложки (или с кадра, где остановился)
  useEffect(() => {
    setCur(Math.min(startFrame, total - 1));
    maxSent.current = -1;
    serial.markOpened(ep.n);
  }, [ep.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // До какой карточки дошёл
  useEffect(() => {
    if (cur <= maxSent.current) return;
    maxSent.current = cur;
    api.serialView(ep.n, cur, total, source).catch(() => {});
  }, [cur, ep.n, total, source]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Новый кадр — время с нуля (эффект стоит раньше таймера и срабатывает первым)
  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [cur, ep.n]);

  // Кадры идут сами; на паузе время стоит и потом продолжается с того же места
  useEffect(() => {
    const dur = cur < ep.frames.length ? ep.frames[cur].dur : 0;
    if (!dur || reduce) {
      setProgress(1);
      return;
    }
    if (paused) return;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      elapsed.current += now - last;
      last = now;
      const p = Math.min(1, elapsed.current / dur);
      setProgress(p);
      if (p >= 1) setCur((c) => Math.min(total - 1, c + 1));
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cur, ep, total, reduce, paused]);

  const go = (d: number) => setCur((c) => Math.max(0, Math.min(total - 1, c + d)));
  // Тап — листать, удержание дольше 0,2 с — пауза, пока палец на экране
  const holdStart = () => {
    holdUsed.current = false;
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holdUsed.current = true;
      setHeld(true);
    }, 200);
  };
  const holdEnd = () => {
    window.clearTimeout(holdTimer.current);
    setHeld(false);
  };
  const tap = (d: number) => {
    if (holdUsed.current) {
      holdUsed.current = false;
      return;
    }
    setPausedTap(false); // листаешь — значит, смотришь дальше
    go(d);
  };
  const tapCenter = () => {
    if (holdUsed.current) {
      holdUsed.current = false;
      return;
    }
    telegramService.haptic('selection');
    setPausedTap((v) => !v);
  };
  const zone = { onPointerDown: holdStart, onPointerUp: holdEnd, onPointerLeave: holdEnd, onPointerCancel: holdEnd, onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
  const frame = cur < ep.frames.length ? ep.frames[cur] : null;
  // Озвучка: реплики кадра, на последнем кадре — endAudio
  const allAudio = [...ep.frames.flatMap((f) => f.audio || []), ...(ep.endAudio || [])];
  const hasAudio = allAudio.length > 0;
  const sound = useFrameAudio(allAudio, frame ? frame.audio : ep.endAudio, `${ep.n}-${cur}`, paused);

  const tryIt = (t: SerialTry) => {
    telegramService.haptic('light');
    api.serialTry(ep.n).catch(() => {});
    onTry(t.to, Math.min(cur + 1, total - 1));
    onClose();
  };

  const toggleHeart = () => {
    telegramService.haptic(liked ? 'selection' : 'success');
    if (!liked) {
      setPop(true);
      setTimeout(() => setPop(false), 450);
    }
    serial.setLiked(ep.n, !liked);
  };

  return createPortal(
    <div className="serial fixed inset-0 z-[70] bg-black flex items-center justify-center" role="dialog" aria-label={`Не Одна Дома. ${ep.title}`}>
      <div onPointerDown={sound.retry} className={`serial-stage ${paused ? 'paused' : ''} w-full max-w-[min(100vw,calc(var(--tg-viewport-stable-height,100vh)*9/16))] aspect-[9/16] max-h-full sm:rounded-[22px]`}>
        {ep.frames.map((f, i) => (
          <div key={i} className={`serial-frame ${i === cur ? 'on' : ''}`} dangerouslySetInnerHTML={{ __html: f.html }} />
        ))}

        {/* Последний кадр: сердечко и следующая серия */}
        <div className={`serial-frame ${cur === total - 1 ? 'on' : ''} bg-[#FAF7F2] flex flex-col items-center justify-center gap-4 px-6 text-center text-[#2B2623]`}>
          <p className="font-hand font-bold text-[38px] leading-none">Понравилась серия?</p>
          <button
            onClick={toggleHeart}
            aria-pressed={liked}
            aria-label="Нравится"
            className="relative z-10 w-28 h-28 rounded-full bg-white border-2 border-[#2B2623] shadow-[4px_4px_0_#2B2623] grid place-items-center cursor-pointer active:translate-y-0.5"
          >
            <svg viewBox="0 0 24 24" width="60" height="60" className={pop ? 'serial-heart-pop' : ''} aria-hidden>
              <path
                d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
                fill={liked ? '#D95C3C' : 'transparent'}
                stroke="#D95C3C"
                strokeWidth="2.2"
              />
            </svg>
          </button>
          <p className="text-sm2 text-[#6B635C]">{hearts > 0 ? `❤️ ${hearts}` : 'Будь первым, кому понравилось'}</p>
          {next && nextOpen ? (
            <button
              onClick={() => onOpen(next, 'next')}
              className="relative z-10 mt-2 h-12 px-5 rounded-full bg-[#D95C3C] text-white font-bold border-2 border-[#2B2623] shadow-[3px_3px_0_#2B2623] cursor-pointer"
            >
              Смотреть серию {next.n} →
            </button>
          ) : tvHint ? null : (
            <p className="text-sm2 text-[#6B635C]">
              {next || ep.n < SERIAL_TOTAL ? (
                <>
                  Серия {ep.n + 1} выйдет{' '}
                  <b className="text-[#2B2623]">
                    {/* Следующую ещё не нарисовали — серии выходят каждый день, значит на следующий день после этой */}
                    {next ? releaseDay(next, true) : dayLabel(new Date(ep.releaseAt).getTime() + 86400000, true)}
                  </b>
                </>
              ) : (
                'Это был финал сезона 🎄'
              )}
            </p>
          )}
          {tvHint && (
            <div className="mt-3 w-full flex items-center gap-3 rounded-[14px] border-2 border-dashed border-[#2B2623]/40 bg-white/70 px-3.5 py-3 text-left">
              <TvArt size={46} className="shrink-0" />
              <p className="text-sm2 leading-snug text-[#2B2623]">
                {nextSoon ? (
                  <>
                    Серия {next!.n} выйдет <b>{releaseDay(next!, true)}</b>. Ищи её в <b>телевизоре справа вверху</b> — там же новости проекта ↗
                  </>
                ) : (
                  <>
                    Новые серии и новости проекта теперь живут в <b>телевизоре справа вверху</b>. Заглядывай туда ↗
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Полоски */}
        <div className="absolute top-2.5 inset-x-2.5 z-20 flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="flex-1 h-[3px] rounded-full bg-white/40 overflow-hidden">
              <span className="block h-full bg-white" style={{ width: `${i < cur ? 100 : i === cur ? progress * 100 : 0}%` }} />
            </span>
          ))}
        </div>

        {/* Тап-зоны: слева назад, в центре пауза, справа дальше. На последнем кадре таймера нет — центр и право не нужны */}
        <button aria-label="Назад" onClick={() => tap(-1)} {...zone} className="absolute inset-y-0 left-0 w-[30%] z-[5] cursor-pointer" />
        {frame && !reduce && (
          <button
            aria-label={pausedTap ? 'Продолжить' : 'Пауза'}
            aria-pressed={pausedTap}
            onClick={tapCenter}
            {...zone}
            className="absolute inset-y-0 left-[30%] w-[40%] z-[5] cursor-pointer"
          />
        )}
        {cur < total - 1 && (
          <button
            aria-label="Дальше"
            onClick={() => tap(1)}
            {...zone}
            className={`absolute inset-y-0 right-0 z-[5] cursor-pointer ${frame && !reduce ? 'w-[30%]' : 'w-[70%]'}`}
          />
        )}

        {frame?.try && (
          <button
            onClick={() => tryIt(frame.try!)}
            className="absolute z-20 left-1/2 -translate-x-1/2 bottom-6 whitespace-nowrap h-12 px-5 rounded-full bg-[#D95C3C] text-white font-bold border-2 border-[#2B2623] shadow-[3px_3px_0_#2B2623] cursor-pointer"
          >
            {frame.try.label}
          </button>
        )}

        {/* На обложке — подсказка, что серию можно смотреть со звуком; нажатие тоже включает */}
        {hasAudio && sound.muted && cur === 0 && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              telegramService.haptic('selection');
              // Обложка с начала — чтобы реплика успела прозвучать целиком
              elapsed.current = 0;
              setProgress(0);
              sound.setMuted(false);
            }}
            className="absolute z-20 right-4 top-[46%] max-w-[210px] rounded-[14px] bg-white border-2 border-[#2B2623] shadow-[3px_3px_0_#2B2623] px-3 py-2 text-left text-[14px] leading-snug text-[#2B2623] cursor-pointer"
          >
            <b>Серия со звуком 🔊</b>
            <br />
            Включи кнопкой вверху справа ↗ или нажми сюда
          </button>
        )}
        {hasAudio && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              telegramService.haptic('selection');
              // Звук не пустили — эта кнопка его и включает, а не выключает
              if (sound.blocked) sound.retry();
              else sound.setMuted(!sound.muted);
            }}
            aria-label={sound.muted ? 'Включить звук' : 'Выключить звук'}
            aria-pressed={!sound.muted}
            className={`absolute z-30 top-[68px] right-2.5 w-10 h-10 rounded-full bg-black/35 text-white grid place-items-center cursor-pointer ${sound.blocked ? 'serial-tv-ring' : ''}`}
          >
            {sound.muted || sound.blocked ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Закрыть серию"
          className="absolute z-30 top-6 right-2.5 w-10 h-10 rounded-full bg-black/35 text-white grid place-items-center cursor-pointer"
        >
          <X size={22} />
        </button>
      </div>
    </div>,
    document.body
  );
};
