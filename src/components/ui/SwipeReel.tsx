import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { telegramService } from '../../services/telegram';

export type SwipeDirection = 'left' | 'right';
// Что происходит с карточкой после свайпа:
// next — улетает, лента листает к следующей; remove — улетает насовсем (её убирают из списка);
// stay — возвращается на место (например, открываем подробности)
export type SwipeBehavior = 'next' | 'remove' | 'stay';

const THRESHOLD = 90; // насколько протянуть пальцем, чтобы свайп сработал

/**
 * Карточка-Reels со свайпами, как в приложениях знакомств.
 * Что делает каждая сторона, задаёт экран: подпись штампа и поведение карточки.
 * Вверх-вниз лента листается как обычно.
 */
export const SwipeReel: React.FC<{
  children: React.ReactNode;
  rightLabel?: string; // штамп при свайпе вправо; нет — вправо не свайпается
  leftLabel?: string;
  rightBehavior?: SwipeBehavior;
  leftBehavior?: SwipeBehavior;
  onSwipe?: (direction: SwipeDirection) => void;
  className?: string;
}> = ({ children, rightLabel, leftLabel, rightBehavior = 'next', leftBehavior = 'next', onSwipe, className = '' }) => {
  const ref = useRef<HTMLElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const justDragged = useRef(false);
  const [dx, setDx] = useState(0);
  const [isAnimated, setIsAnimated] = useState(true);
  // Для «remove»: лента и где она стояла — чтобы после удаления карточки
  // браузер не отпрыгнул к другой (scroll-snap ищет новую опору)
  const removal = useRef<{ list: HTMLElement; top: number } | null>(null);

  useLayoutEffect(
    () => () => {
      const saved = removal.current;
      if (saved) queueMicrotask(() => (saved.list.scrollTop = saved.top));
    },
    []
  );

  const canSwipe = (dir: SwipeDirection) => (dir === 'right' ? Boolean(rightLabel) : Boolean(leftLabel));

  const reset = (animated: boolean) => {
    setIsAnimated(animated);
    setDx(0);
  };

  const finish = (dir: SwipeDirection) => {
    telegramService.haptic(dir === 'right' ? 'success' : 'light');
    const behavior = dir === 'right' ? rightBehavior : leftBehavior;
    setIsAnimated(true);
    if (behavior === 'stay') {
      reset(true);
      onSwipe?.(dir);
      return;
    }
    setDx((dir === 'right' ? 1 : -1) * window.innerWidth * 1.2);
    if (behavior === 'remove') {
      // Карточку убирают из списка — следующая сама встаёт на её место.
      // Если так и не убрали (например, ошибка сети), возвращаем
      const list = ref.current?.closest('.snap-y') as HTMLElement | null;
      if (list) removal.current = { list, top: list.scrollTop };
      window.setTimeout(() => {
        onSwipe?.(dir);
        window.setTimeout(() => {
          if (!ref.current) return;
          removal.current = null;
          reset(true);
        }, 1500);
      }, 200);
      return;
    }
    window.setTimeout(() => {
      const list = ref.current?.closest('.snap-y') as HTMLElement | null;
      const hasNext = Boolean(ref.current?.nextElementSibling);
      if (list && hasNext) {
        const target = list.scrollTop + list.clientHeight;
        const startedAt = Date.now();
        list.scrollBy({ top: list.clientHeight, behavior: 'smooth' });
        // Действие — когда лента уже перелистнулась: иначе обновление списка
        // во время прокрутки возвращает ленту на эту же карточку.
        // Карточку ставим на место, когда она уже за экраном
        const waitScrolled = () => {
          if (Math.abs(list.scrollTop - target) > 2) {
            if (Date.now() - startedAt < 700) {
              window.setTimeout(waitScrolled, 50);
              return;
            }
            list.scrollTo({ top: target }); // плавная прокрутка не успела — листаем сразу
          }
          reset(false);
          onSwipe?.(dir);
        };
        window.setTimeout(waitScrolled, 100);
      } else {
        onSwipe?.(dir);
        reset(true);
      }
    }, 200);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Ряды, которые сами листаются вбок (чипсы), свайпом не считаем
    if ((e.target as HTMLElement).closest('[data-no-swipe]')) return;
    start.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const moveX = e.clientX - start.current.x;
    const moveY = e.clientY - start.current.y;
    if (!isDragging.current) {
      if (Math.abs(moveX) > 12 && Math.abs(moveX) > Math.abs(moveY) * 1.3) {
        isDragging.current = true;
        setIsAnimated(false);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } else if (Math.abs(moveY) > 12) {
        start.current = null; // листают вверх-вниз
      }
      return;
    }
    const dir: SwipeDirection = moveX > 0 ? 'right' : 'left';
    // В сторону без действия карточка лишь чуть поддаётся
    setDx(canSwipe(dir) ? moveX : moveX / 5);
  };

  const onPointerUp = () => {
    start.current = null;
    if (!isDragging.current) return;
    isDragging.current = false;
    justDragged.current = true;
    window.setTimeout(() => (justDragged.current = false), 50);
    const dir: SwipeDirection = dx > 0 ? 'right' : 'left';
    if (Math.abs(dx) > THRESHOLD && canSwipe(dir)) finish(dir);
    else reset(true);
  };

  const progress = Math.min(Math.abs(dx) / THRESHOLD, 1);

  return (
    <section ref={ref} className="relative h-full w-full snap-start snap-always overflow-hidden bg-[#141210]">
      <div
        className={`absolute inset-0 touch-pan-y select-none ${className}`}
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 25}deg)`,
          transition: isAnimated ? 'transform 0.25s ease-out' : 'none'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // Свайп не должен нажимать кнопки под пальцем
          if (justDragged.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}

        {/* Штампы, как в приложениях знакомств */}
        {dx > 0 && rightLabel && (
          <div
            className="absolute top-48 left-6 z-30 px-4 py-2 rounded-zine-sm border-[3px] border-[#5FD39A] text-white bg-[#2FA36B]/30 backdrop-blur-md font-bold text-title uppercase -rotate-12 pointer-events-none"
            style={{ opacity: progress }}
          >
            {rightLabel}
          </div>
        )}
        {dx < 0 && leftLabel && (
          <div
            className="absolute top-48 right-6 z-30 px-4 py-2 rounded-zine-sm border-[3px] border-white/80 text-white bg-white/15 backdrop-blur-md font-bold text-title uppercase rotate-12 pointer-events-none"
            style={{ opacity: progress }}
          >
            {leftLabel}
          </div>
        )}
      </div>
    </section>
  );
};

// Подсказка на первой карточке: что делают свайпы
// Подсказка про жесты на первой карточке: тёмная плашка, чтобы читалась на любом фоне; через несколько секунд исчезает.
// inline — в потоке (над текстом карточки), иначе поверх по className
export const SwipeHint: React.FC<{ left?: string; right?: string; className?: string; inline?: boolean; extra?: string }> = ({ left, right, className = 'top-36', inline, extra }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 7000);
    return () => clearTimeout(t);
  }, []);
  const parts = [left && `← ${left}`, right && `${right} →`, '↑ листай'].filter(Boolean) as string[];
  // Вторая строка подсказки (например, как листать фото) — отдельной плашкой под первой
  if (extra) {
    return (
      <div className={`${inline ? 'mb-3' : `absolute left-1/2 -translate-x-1/2 z-10 ${className}`} flex flex-col items-start gap-1.5`}>
        <SwipeHint left={left} right={right} inline />
        <span
          aria-hidden
          className={`-mt-1.5 px-3.5 py-2 rounded-full bg-black/70 text-sm2 font-semibold text-white whitespace-nowrap pointer-events-none transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
          {extra}
        </span>
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={`${inline ? 'inline-flex mb-3' : `absolute left-1/2 -translate-x-1/2 z-10 flex ${className}`} items-center gap-2.5 px-3.5 py-2 rounded-full bg-black/70 text-sm2 font-semibold text-white whitespace-nowrap pointer-events-none transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {parts.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && <span className="w-1 h-1 rounded-full bg-white/50" />}
          <span>{p}</span>
        </React.Fragment>
      ))}
    </div>
  );
};
