import React, { useState } from 'react';
import { X } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { NOTICE_TEXTS as T } from '../../texts/notices';

export interface Notice {
  id: string;
  text: string;
  action?: string; // ярко справа от текста: «Пойдёшь? →»
  onClick: () => void;
  hideDays: number; // на сколько дней прячем по крестику
  group?: string; // закрыли вторую из группы (сходки) — спрашиваем «Скрыть все?»
}

const KEY = 'yesminsk_notice_hidden';

// Спрятанные крестиком: id → до какого времени. Истёкшие выбрасываем, чтобы список не рос (у сходок свои id)
const loadHidden = (): Record<string, number> => {
  try {
    const all: Record<string, number> = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.fromEntries(Object.entries(all).filter(([, until]) => until > Date.now()));
  } catch {
    return {};
  }
};

// Сколько карточек группы закрыли крестиком за этот запуск: на второй спрашиваем «Скрыть все?» (один раз)
const closedInGroup: Record<string, number> = {};
const askedGroups = new Set<string>();

/**
 * Подсказки над нижним меню вместо рассылок бота: самые важные из ещё не сделанных, тёмными карточками.
 * Несколько — листаются вбок (справа виден край следующей, снизу точки). Нажатие — сделать,
 * крестик — спрятать эту подсказку на несколько дней. Закрыл вторую из группы (сходки) — предлагаем скрыть все сразу
 */
export const NoticeBar: React.FC<{ notices: Notice[] }> = ({ notices }) => {
  const [hidden, setHidden] = useState(loadHidden);
  const [active, setActive] = useState(0);
  const [askAll, setAskAll] = useState<Notice | null>(null);
  const left = notices.filter((n) => !(hidden[n.id] > Date.now()));
  if (!left.length) return null;
  const many = left.length > 1;

  const hide = (list: Notice[], days?: number) => {
    telegramService.haptic('light');
    const next = { ...hidden };
    for (const n of list) next[n.id] = Date.now() + (days ?? n.hideDays) * 24 * 60 * 60 * 1000;
    setHidden(next);
    setAskAll(null);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // не страшно: спрячется до следующего запуска
    }
  };

  const close = (notice: Notice) => {
    const g = notice.group;
    if (g) {
      closedInGroup[g] = (closedInGroup[g] || 0) + 1;
      const others = left.filter((n) => n.group === g && n.id !== notice.id);
      if (closedInGroup[g] >= 2 && others.length && !askedGroups.has(g)) {
        askedGroups.add(g);
        telegramService.haptic('selection');
        setAskAll(notice);
        return;
      }
    }
    hide([notice]);
  };

  return (
    <div className="shrink-0 pt-1.5 pb-1 bg-zine-paper">
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          const card = el.firstElementChild as HTMLElement | null;
          if (card) setActive(Math.round(el.scrollLeft / (card.offsetWidth + 8)));
        }}
        className="flex gap-2 px-3 scroll-px-3 overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {left.map((notice) =>
          askAll?.id === notice.id ? (
            <div
              key={notice.id}
              className={`snap-start shrink-0 ${many ? 'w-[calc(100%-20px)]' : 'w-full'} min-h-[57px] pl-3.5 pr-2 py-2 flex items-center gap-2 rounded-zine-sm bg-[#2B2623] text-[#FAF7F2] border border-white/10 shadow-zine-sm`}
            >
              <span className="flex-1 min-w-0 text-[14px] leading-[19px] font-semibold">{T.hideAllQuestion}</span>
              <button onClick={() => hide(left.filter((n) => n.group === notice.group), 1)} className="h-9 px-3 shrink-0 rounded-full bg-[#F0997B] text-[#2B2623] text-[14px] font-bold cursor-pointer">
                {T.hideAll}
              </button>
              <button onClick={() => hide([notice])} className="h-9 px-3 shrink-0 rounded-full bg-white/10 text-[14px] font-semibold cursor-pointer">
                {T.hideOne}
              </button>
            </div>
          ) : (
            <div
              key={notice.id}
              className={`snap-start shrink-0 ${many ? 'w-[calc(100%-20px)]' : 'w-full'} flex items-center rounded-zine-sm bg-[#2B2623] text-[#FAF7F2] border border-white/10 shadow-zine-sm`}
            >
              <button
                onClick={() => {
                  telegramService.haptic('selection');
                  notice.onClick();
                }}
                className="flex-1 min-w-0 min-h-[44px] pl-3.5 py-2 flex items-center gap-2 text-left text-[14px] leading-[19px] font-semibold cursor-pointer"
              >
                <span className="flex-1 min-w-0 line-clamp-2">{notice.text}</span>
                {/* Действие — отдельно справа: длинный текст обрежется, а «Пойдёшь? →» видно всегда */}
                {notice.action && <span className="shrink-0 font-bold text-[#F0997B] whitespace-nowrap">{notice.action}</span>}
              </button>
              <button onClick={() => close(notice)} aria-label={T.close} className="w-10 h-11 shrink-0 flex items-center justify-center text-[#B2A9A0] cursor-pointer">
                <X size={16} />
              </button>
            </div>
          )
        )}
      </div>
      {many && (
        <div className="mt-1 flex justify-center gap-1" aria-hidden>
          {left.map((n, i) => (
            <span key={n.id} className={`h-1 rounded-full transition-all ${i === Math.min(active, left.length - 1) ? 'w-3 bg-zine-terracotta' : 'w-1 bg-zine-border'}`} />
          ))}
        </div>
      )}
    </div>
  );
};
