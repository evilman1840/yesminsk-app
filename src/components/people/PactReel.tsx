import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { FEED_TEXTS as T } from '../../texts/feed';

/**
 * «Договоримся?» между анкетами: здесь дружба, не свидания, и как пожаловаться.
 * Пока человек не нажал «Я за дружбу и уважение» — не чаще раза в день, после — раз в неделю.
 * Хранится в браузере: это удобство, а не правило — очистили хранилище, увидят карточку ещё раз
 */

const DAY = 24 * 60 * 60 * 1000;
const AGREED_KEY = 'yesminsk_pact_agreed_at';
const SHOWN_KEY = 'yesminsk_pact_shown_at';

const read = (key: string) => {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};
const write = (key: string) => {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {}
};

// После какой анкеты показать (null — сегодня не показываем). Решаем один раз при открытии ленты.
// Ещё не соглашался(ась) — рано, после 2-й анкеты; согласился(ась) — подальше, после 15-й
export const pactSlotAfter = (): number | null => {
  const agreed = read(AGREED_KEY);
  if (Date.now() - read(SHOWN_KEY) < (agreed ? 7 : 1) * DAY) return null;
  return agreed ? 14 : 1;
};

export const PactReel: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  const [agreed, setAgreed] = useState(false);

  // Показали — когда долистали до карточки, а не когда она отрисовалась в ленте
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        write(SHOWN_KEY);
        io.disconnect();
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const agree = () => {
    if (agreed) return;
    telegramService.haptic('success');
    write(AGREED_KEY);
    setAgreed(true);
  };

  return (
    <section ref={ref} className="h-full w-full snap-start snap-always p-3">
      <div className="h-full rounded-zine bg-zine-card border border-zine-border flex flex-col items-center justify-center text-center px-6 text-zine-ink">
        <div className="text-[56px] leading-none mb-4" aria-hidden>
          🤝
        </div>
        <p className="font-serif font-bold text-title">{T.pactTitle}</p>
        <p className="mt-2 max-w-[300px] text-body text-zine-inkMuted">{T.pactText}</p>
        <button
          onClick={agree}
          aria-pressed={agreed}
          className={`mt-6 h-12 px-6 rounded-full border-2 border-zine-sage text-body font-bold flex items-center justify-center gap-2 active:scale-95 transition-colors cursor-pointer ${
            agreed ? 'bg-zine-sage text-white' : 'text-zine-ink'
          }`}
        >
          <Check size={18} strokeWidth={3} className={agreed ? '' : 'text-zine-sage'} />
          {agreed ? T.pactAgreed : T.pactAgree}
        </button>
        <p className="mt-6 max-w-[300px] text-sm2 text-zine-inkMuted">{T.pactReport}</p>
      </div>
    </section>
  );
};
