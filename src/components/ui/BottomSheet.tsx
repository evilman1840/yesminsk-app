import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackButton } from '../../hooks/useTelegram';

const CLOSE_DISTANCE = 110; // протянуть вниз дальше — шторка закроется

/**
 * Шторка снизу экрана с затемнением фона.
 * Закрывается кнопкой ✕, тапом по фону или смахиванием вниз
 * (за шапку — всегда, за содержимое — когда оно прокручено к началу).
 * Рисуется поверх всего экрана (портал в body), чтобы ряды фильтров с прокруткой и т.п. её не обрезали
 */
export const BottomSheet: React.FC<{
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode; // закреплено внизу шторки — главные кнопки всегда на виду
}> = ({ onClose, title, children, footer }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [dy, setDy] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const closeAnimated = () => {
    setIsDragging(false);
    setDy(window.innerHeight);
    window.setTimeout(() => onCloseRef.current(), 200);
  };

  // Нативная «Назад» Telegram закрывает верхнюю шторку
  useBackButton(closeAnimated);

  // Смахивание вниз пальцем. Слушатели нативные: touchmove должен уметь
  // отменять прокрутку страницы, а React вешает его пассивным
  useEffect(() => {
    const sheet = sheetRef.current;
    const content = contentRef.current;
    if (!sheet || !content) return;
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let decided = false;
    let active = false;
    let current = 0;

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startedAt = Date.now();
      decided = false;
      active = false;
      current = 0;
    };
    const onMove = (e: TouchEvent) => {
      const moveX = e.touches[0].clientX - startX;
      const moveY = e.touches[0].clientY - startY;
      if (!decided) {
        if (Math.abs(moveX) < 8 && Math.abs(moveY) < 8) return;
        decided = true;
        const fromContent = content.contains(e.target as Node);
        active = moveY > 0 && Math.abs(moveY) > Math.abs(moveX) && (!fromContent || content.scrollTop <= 0);
        if (active) setIsDragging(true);
      }
      if (!active) return;
      e.preventDefault();
      current = Math.max(0, moveY);
      setDy(current);
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      const isFlick = current > 50 && Date.now() - startedAt < 250;
      if (current > CLOSE_DISTANCE || isFlick) closeAnimated();
      else {
        setIsDragging(false);
        setDy(0);
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  // Мышью (на компьютере) — тянем за шапку
  const mouseStart = useRef<number | null>(null);
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || (e.target as HTMLElement).closest('button')) return;
    mouseStart.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (mouseStart.current === null) return;
    setDy(Math.max(0, e.clientY - mouseStart.current));
  };
  const onHeaderPointerUp = () => {
    if (mouseStart.current === null) return;
    mouseStart.current = null;
    if (dy > CLOSE_DISTANCE) closeAnimated();
    else {
      setIsDragging(false);
      setDy(0);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/45 animate-in fade-in duration-200"
        style={{ opacity: Math.max(0, 1 - dy / 500), transition: isDragging ? 'none' : 'opacity 0.2s ease-out' }}
      />
      <div
        ref={sheetRef}
        className="relative w-full max-w-[420px]"
        style={{ transform: `translateY(${dy}px)`, transition: isDragging ? 'none' : 'transform 0.2s ease-out' }}
      >
        <div className="max-h-[calc(var(--tg-viewport-stable-height,100vh)*0.92)] flex flex-col bg-zine-cardElevated rounded-t-zine-lg shadow-zine-float animate-in slide-in-from-bottom-8 fade-in duration-200">
          <div
            className="shrink-0 flex items-center justify-between gap-3 px-5 pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onPointerCancel={onHeaderPointerUp}
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-zine-border" />
            <h3 className="font-serif font-bold text-title text-zine-ink pt-3 line-clamp-2">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="mt-2 w-11 h-11 shrink-0 rounded-full bg-zine-card text-zine-inkMuted flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <X size={22} />
            </button>
          </div>
          <div ref={contentRef} className={`overflow-y-auto overscroll-contain px-5 ${footer ? '' : 'pb-safe'}`}>
            <div className="pb-4">{children}</div>
          </div>
          {footer && <div className="shrink-0 px-5 pt-3 pb-safe border-t border-zine-border bg-zine-cardElevated">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
};
