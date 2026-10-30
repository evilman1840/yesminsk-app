import React, { useState } from 'react';
import { X } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { NOTICE_TEXTS as T } from '../../texts/notices';

export interface Notice {
  id: string;
  text: string;
  action?: string; // ярко в конце текста: «Пойдёшь? →»
  onClick: () => void;
  hideDays: number; // на сколько дней прячем по крестику
}

const KEY = 'yesminsk_notice_hidden';

const loadHidden = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

/**
 * Подсказки над нижним меню вместо рассылок бота: самые важные из ещё не сделанных, тёмными карточками.
 * Несколько — листаются вбок (справа виден край следующей, снизу точки). Нажатие — сделать,
 * крестик — спрятать эту подсказку на несколько дней
 */
export const NoticeBar: React.FC<{ notices: Notice[] }> = ({ notices }) => {
  const [hidden, setHidden] = useState(loadHidden);
  const [active, setActive] = useState(0);
  const left = notices.filter((n) => !(hidden[n.id] > Date.now()));
  if (!left.length) return null;
  const many = left.length > 1;

  const close = (notice: Notice) => {
    telegramService.haptic('light');
    const next = { ...hidden, [notice.id]: Date.now() + notice.hideDays * 24 * 60 * 60 * 1000 };
    setHidden(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // не страшно: спрячется до следующего запуска
    }
  };

  return (
    <div className="shrink-0 pt-2 pb-1.5 bg-zine-paper">
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          const card = el.firstElementChild as HTMLElement | null;
          if (card) setActive(Math.round(el.scrollLeft / (card.offsetWidth + 8)));
        }}
        className="flex gap-2 px-3 scroll-px-3 overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {left.map((notice) => (
          <div
            key={notice.id}
            className={`snap-start shrink-0 ${many ? 'w-[calc(100%-20px)]' : 'w-full'} flex items-center rounded-zine-sm bg-[#2B2623] text-[#FAF7F2] border border-white/10 shadow-zine-sm`}
          >
            <button
              onClick={() => {
                telegramService.haptic('selection');
                notice.onClick();
              }}
              className="flex-1 min-w-0 min-h-[52px] pl-4 py-2.5 text-left text-sm2 font-semibold leading-snug cursor-pointer"
            >
              <span className={notice.action ? 'line-clamp-3' : 'line-clamp-2'}>
                {notice.text}
                {notice.action && <span className="font-bold text-[#F0997B] whitespace-nowrap"> {notice.action}</span>}
              </span>
            </button>
            <button onClick={() => close(notice)} aria-label={T.close} className="w-11 h-11 shrink-0 flex items-center justify-center text-[#B2A9A0] cursor-pointer">
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
      {many && (
        <div className="mt-1.5 flex justify-center gap-1" aria-hidden>
          {left.map((n, i) => (
            <span key={n.id} className={`h-1 rounded-full transition-all ${i === Math.min(active, left.length - 1) ? 'w-3 bg-zine-terracotta' : 'w-1 bg-zine-border'}`} />
          ))}
        </div>
      )}
    </div>
  );
};
