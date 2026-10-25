import React, { useEffect, useRef } from 'react';

/**
 * Плашка «Скрыто · Вернуть» после свайпа «Неинтересно». Сама исчезает через несколько секунд
 */
export const UndoToast: React.FC<{
  text: string;
  onUndo: () => void;
  onDone: () => void;
  topClass?: string;
  secondary?: { label: string; onClick: () => void }; // ещё одно действие мелкой ссылкой, например «или скрыть навсегда?»
}> = ({ text, onUndo, onDone, topClass = 'top-[118px]', secondary }) => {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), secondary ? 6000 : 4500);
    return () => window.clearTimeout(timer);
  }, [text]);

  if (secondary) {
    return (
      <div className={`absolute ${topClass} inset-x-4 z-40 pl-4 pr-1.5 py-1.5 rounded-zine-sm bg-black/70 backdrop-blur-md border border-white/15 text-white animate-in fade-in slide-in-from-top-2 duration-200`}>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm2">{text}</span>
          <button onClick={onUndo} className="shrink-0 h-9 px-4 rounded-full bg-white/15 text-sm2 font-bold text-[#FFD9A8] cursor-pointer active:scale-95 transition-transform">
            Вернуть
          </button>
        </div>
        <button onClick={secondary.onClick} className="h-8 text-cap font-semibold text-white/75 underline underline-offset-2 cursor-pointer">
          {secondary.label}
        </button>
      </div>
    );
  }

  return (
    <div className={`absolute ${topClass} inset-x-4 z-40 h-12 pl-4 pr-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200`}>
      <span className="min-w-0 truncate text-sm2">{text}</span>
      <button onClick={onUndo} className="shrink-0 h-9 px-4 rounded-full bg-white/15 text-sm2 font-bold text-[#FFD9A8] cursor-pointer active:scale-95 transition-transform">
        Вернуть
      </button>
    </div>
  );
};
