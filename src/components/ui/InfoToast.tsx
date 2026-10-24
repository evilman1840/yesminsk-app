import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Короткое сообщение поверх экрана (например, «Желание отмечено»). Само исчезает, можно закрыть тапом
 */
export const InfoToast: React.FC<{ title: string; text?: string; onDone: () => void; duration?: number }> = ({ title, text, onDone, duration = 6000 }) => {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [title, duration]);

  return createPortal(
    <div className="fixed inset-x-0 top-3 z-[60] flex justify-center px-4 pointer-events-none">
      <button
        onClick={() => onDoneRef.current()}
        className="pointer-events-auto w-full max-w-[400px] p-4 rounded-zine bg-zine-ink text-zine-paper text-left shadow-zine-float animate-in fade-in slide-in-from-top-2 duration-200 cursor-pointer"
      >
        <span className="block text-body font-bold">{title}</span>
        {text && <span className="mt-1 block text-sm2 opacity-85">{text}</span>}
      </button>
    </div>,
    document.body
  );
};
