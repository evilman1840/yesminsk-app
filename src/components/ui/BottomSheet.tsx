import React from 'react';
import { X } from 'lucide-react';

/**
 * Шторка снизу экрана с затемнением фона. Закрывается кнопкой ✕ или тапом по фону
 */
export const BottomSheet: React.FC<{
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center">
    <div onClick={onClose} className="absolute inset-0 bg-black/45 animate-in fade-in duration-200" />
    <div className="relative w-full max-w-[420px] max-h-[92vh] flex flex-col bg-zine-cardElevated rounded-t-zine-lg shadow-zine-float animate-in slide-in-from-bottom-8 fade-in duration-200">
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 pt-3 pb-2">
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
      <div className="overflow-y-auto px-5 pb-safe">
        <div className="pb-4">{children}</div>
      </div>
    </div>
  </div>
);
