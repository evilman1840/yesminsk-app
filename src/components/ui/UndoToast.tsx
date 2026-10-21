import React, { useEffect, useRef } from 'react';

/**
 * Плашка «Скрыто · Вернуть» после свайпа «Неинтересно». Сама исчезает через несколько секунд
 */
export const UndoToast: React.FC<{ text: string; onUndo: () => void; onDone: () => void }> = ({ text, onUndo, onDone }) => {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), 4500);
    return () => window.clearTimeout(timer);
  }, [text]);

  return (
    <div className="absolute top-[118px] inset-x-4 z-40 h-12 pl-4 pr-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <span className="min-w-0 truncate text-sm2">{text}</span>
      <button onClick={onUndo} className="shrink-0 h-9 px-4 rounded-full bg-white/15 text-sm2 font-bold text-[#FFD9A8] cursor-pointer active:scale-95 transition-transform">
        Вернуть
      </button>
    </div>
  );
};
