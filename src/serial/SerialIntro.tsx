import React from 'react';
import { createPortal } from 'react-dom';
import { X, Play } from 'lucide-react';
import { telegramService } from '../services/telegram';
import { useBackButton } from '../hooks/useTelegram';

// Каждый элемент появляется по очереди — как слайды на презентации
const at = (s: number): React.CSSProperties => ({ animationDelay: `${s}s` });

const TITLE = 'Не Одна Дома';
const CONFETTI = ['#D95C3C', '#E2A03F', '#8FA77A', '#E8A6A0', '#FFF6E6', '#7C9CC4'];

/**
 * Премьера сериала: письмо от Миши на весь экран, один раз каждому после выхода первой серии.
 * «Смотреть» включает серию 1, ✕ просто закрывает
 */
export const SerialIntro: React.FC<{ onWatch: () => void; onClose: () => void }> = ({ onWatch, onClose }) => {
  useBackButton(onClose);
  const titleStart = 2.5;

  return createPortal(
    <div
      className="serial serial-intro fixed inset-0 z-[72] overflow-hidden bg-[#1F1A17] text-[#FFF6E6]"
      role="dialog"
      aria-label="Премьера: мини-сериал «Не Одна Дома»"
    >
      {/* Сцена: прожектор и лучи за названием */}
      <div aria-hidden className="intro-spot absolute inset-0" />
      <div aria-hidden className="intro-rays absolute left-1/2 bottom-[150px] w-[900px] h-[900px] -ml-[450px] -mb-[450px]" style={at(titleStart - 0.2)} />

      {/* Конфетти — после названия */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 26 }, (_, i) => (
          <span
            key={i}
            className="intro-confetti absolute top-0 block"
            style={{
              left: `${(i * 37) % 100}%`,
              width: i % 3 ? 7 : 10,
              height: i % 3 ? 12 : 10,
              borderRadius: i % 3 ? 2 : 999,
              background: CONFETTI[i % CONFETTI.length],
              animationDelay: `${titleStart + 0.7 + (i % 7) * 0.12}s`,
              animationDuration: `${2.4 + (i % 5) * 0.35}s`,
              ['--x' as string]: `${((i * 53) % 80) - 40}px`,
              ['--r' as string]: `${(i * 97) % 720}deg`
            }}
          />
        ))}
      </div>

      <div className="relative h-full overflow-y-auto no-scrollbar">
        <div className="min-h-full max-w-[440px] mx-auto px-5 pt-[max(52px,calc(var(--tg-content-safe-area-inset-top,0px)+var(--tg-safe-area-inset-top,0px)+44px))] pb-[max(16px,env(safe-area-inset-bottom))] flex flex-col">
          {/* Миша */}
          <div className="flex items-center gap-3">
            <span className="intro-pop shrink-0 w-[68px] h-[68px] rounded-full overflow-hidden bg-[#F6E2BD] border-[3px] border-[#FFF6E6] shadow-[3px_3px_0_#D95C3C]" style={at(0.15)}>
              <svg viewBox="45 40 110 110" width="62" height="62" aria-hidden>
                <use href="#misha" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="intro-up font-hand font-bold text-[40px] leading-[0.95]" style={at(0.4)}>
                Привет, Гуляка!
              </h2>
              <p className="intro-up mt-1 text-[14px] font-semibold text-[#FFF6E6]/75" style={at(0.65)}>
                Я Миша Спасатель, автор ГУЛЯЙ!
              </p>
            </div>
          </div>

          {/* Письмо */}
          <div className="mt-4 space-y-2.5 text-[15.5px] leading-[1.42] text-[#FFF6E6]/90">
            <p className="intro-up" style={at(0.95)}>
              Давно искал способ поговорить с тобой — и нарисовал <b className="text-[#FFF6E6]">мини-сериал в комиксах</b>.
            </p>
            <p className="intro-up" style={at(1.25)}>
              Там смешная история и заодно — как пользоваться приложением. Польза есть, улыбка гарантирована&nbsp;🙂
            </p>
            <p className="intro-up text-[#FFF6E6]/70" style={at(1.55)}>
              Иногда буду напоминать про донаты: без них ГУЛЯЙ не выживет&nbsp;🥧
            </p>
          </div>

          <div className="flex-1 min-h-3" />

          {/* Премьера */}
          <p className="intro-up font-hand font-bold text-[26px] leading-none text-[#E2A03F]" style={at(1.95)}>
            Итак, представляю тебе:
          </p>
          <div className="mt-3 flex items-center gap-3">
            {/* Телевизор включается */}
            <span className="intro-pop relative shrink-0" style={at(titleStart - 0.3)}>
              <svg viewBox="0 0 44 44" width="104" height="104" aria-hidden className="intro-tv">
                <path d="M15 3 L21 10 M29 3 L23 10" stroke="#FFF6E6" strokeWidth="2" strokeLinecap="round" />
                <rect x="3" y="10" width="38" height="31" rx="8" fill="#D95C3C" stroke="#FFF6E6" strokeWidth="1.6" />
                <clipPath id="intro-tv-screen">
                  <rect x="7" y="14" width="24" height="23" rx="5" />
                </clipPath>
                <rect x="7" y="14" width="24" height="23" rx="5" fill="#111" />
                <g clipPath="url(#intro-tv-screen)">
                  <g className="intro-tv-on" style={at(titleStart)}>
                    <rect x="7" y="14" width="24" height="23" fill="#F6E2BD" />
                    <svg x="7" y="14" width="24" height="23" viewBox="50 54 100 96" preserveAspectRatio="xMidYMid slice">
                      <use href="#vasya" />
                      <use href="#v-open" />
                    </svg>
                  </g>
                </g>
                <rect x="7" y="14" width="24" height="23" rx="5" fill="none" stroke="#2B2623" strokeWidth="1.4" />
                <circle cx="36" cy="20" r="2" fill="#2B2623" />
                <circle cx="36" cy="27" r="2" fill="#2B2623" />
              </svg>
            </span>
            <h1 className="font-hand font-bold text-[56px] leading-[0.82] text-[#FFF6E6] [text-shadow:3px_3px_0_#D95C3C]" aria-label={TITLE}>
              {['Не Одна', 'Дома'].map((word, w, words) => (
                <span key={w} className="block whitespace-nowrap" aria-hidden>
                  {[...word].map((ch, i) => {
                    if (ch === ' ') return <span key={i}> </span>;
                    const n = words.slice(0, w).join('').length + i;
                    return (
                      <span key={i} className="intro-letter inline-block" style={at(titleStart + 0.06 * n)}>
                        {ch}
                      </span>
                    );
                  })}
                </span>
              ))}
            </h1>
          </div>

          <button
            onClick={() => {
              telegramService.haptic('success');
              onWatch();
            }}
            className="intro-btn relative mt-5 w-full h-14 rounded-full overflow-hidden bg-[#D95C3C] text-white text-[18px] font-bold border-2 border-[#FFF6E6] shadow-[4px_4px_0_#E2A03F] flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5"
            style={at(titleStart + 0.9)}
          >
            <Play size={20} fill="currentColor" />
            Смотреть
            <span aria-hidden className="intro-shine absolute inset-y-0 -left-1/2 w-1/3" />
          </button>
          <p className="intro-up mt-2 text-center text-[13px] text-[#FFF6E6]/60" style={at(titleStart + 1.1)}>
            Серия 1 · 30 секунд · новая каждый день в 10:00
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute z-10 right-3 top-[max(10px,calc(var(--tg-content-safe-area-inset-top,0px)+var(--tg-safe-area-inset-top,0px)+4px))] w-10 h-10 rounded-full bg-white/10 text-[#FFF6E6] grid place-items-center cursor-pointer"
      >
        <X size={22} />
      </button>
    </div>,
    document.body
  );
};
