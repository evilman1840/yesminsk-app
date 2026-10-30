import React, { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { NOTICE_TEXTS as T } from '../../texts/notices';

export interface Notice {
  id: string;
  text: string;
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

// Закрыли одну — до следующего запуска больше не показываем (не надоедаем)
let closedThisLaunch = false;

/**
 * Одна строка подсказки над нижним меню вместо рассылок бота: самая важная из ещё не сделанных.
 * Нажатие — сделать, крестик — спрятать на несколько дней
 */
export const NoticeBar: React.FC<{ notices: Notice[] }> = ({ notices }) => {
  const [hidden, setHidden] = useState(loadHidden);
  const [isClosed, setIsClosed] = useState(closedThisLaunch);
  const left = notices.filter((n) => !(hidden[n.id] > Date.now()));
  const notice = left[0];
  if (isClosed || !notice) return null;

  const close = () => {
    telegramService.haptic('light');
    const next = { ...hidden, [notice.id]: Date.now() + notice.hideDays * 24 * 60 * 60 * 1000 };
    setHidden(next);
    closedThisLaunch = true;
    setIsClosed(true);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // не страшно: спрячется до следующего запуска
    }
  };

  // Карточка с акцентом слева: «Подсказка 1 из N» и точки — сколько ещё осталось сделать
  return (
    <div className="shrink-0 px-3 pt-2 pb-1.5 bg-zine-paper">
      <div className="relative overflow-hidden rounded-zine-sm bg-zine-cardElevated border border-zine-border shadow-zine-sm">
        <span className="absolute inset-y-0 left-0 w-1 bg-zine-terracotta" aria-hidden />
        <div className="flex items-center justify-between pl-4 text-cap text-zine-inkMuted">
          <span>{T.counter(left.length)}</span>
          <span className="flex items-center gap-1">
            {left.map((n, i) => (
              <span key={n.id} className={`h-1 rounded-full ${i === 0 ? 'w-3 bg-zine-terracotta' : 'w-1 bg-zine-border'}`} />
            ))}
            <button onClick={close} aria-label={T.close} className="w-11 h-9 -mr-1 flex items-center justify-center cursor-pointer">
              <X size={16} />
            </button>
          </span>
        </div>
        <button
          onClick={() => {
            telegramService.haptic('selection');
            notice.onClick();
          }}
          className="w-full min-h-[40px] -mt-1 pl-4 pr-3 pb-2.5 flex items-center gap-1 text-left text-sm2 font-semibold text-zine-ink cursor-pointer"
        >
          <span className="line-clamp-2">{notice.text}</span>
          <ChevronRight size={18} className="ml-auto shrink-0 text-zine-inkMuted" />
        </button>
      </div>
    </div>
  );
};
