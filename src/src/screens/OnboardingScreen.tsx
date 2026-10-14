import React from 'react';
import { HeartHandshake, EyeOff, Coffee, Check, Sparkles } from 'lucide-react';
import { telegramService } from '../services/telegram';

interface OnboardingScreenProps {
  onAgree: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onAgree }) => {
  const handleAgreeClick = () => {
    telegramService.haptic('medium');
    onAgree();
  };

  return (
    <div className="flex flex-col h-full w-full zine-paper-texture overflow-y-auto px-5 py-6 justify-between select-none">
      
      {/* Шапка манифеста */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zine-terracotta text-white flex items-center justify-center font-serif font-bold text-sm shadow-zine-sm">
              Y
            </div>
            <span className="font-serif font-bold text-lg text-zine-ink tracking-tight">YesMinsk</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zine-terracotta/10 text-zine-terracotta border border-zine-terracotta/20">
            Манифест
          </span>
        </div>

        {/* Заголовок зина */}
        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-zine-terracotta text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles size={14} />
            <span>Город открытых людей</span>
          </div>
          <h1 className="font-serif font-bold text-2xl text-zine-ink leading-tight">
            Ищи компанию, <br />
            <span className="italic font-normal text-zine-terracotta">а не романтику.</span>
          </h1>
          <p className="text-xs text-zine-inkMuted mt-2 leading-relaxed font-normal">
            YesMinsk — продолжение гида по Минску. Мы помогаем находить единомышленников для прогулок, кофе и совместного досуга без дейтинг-вайба.
          </p>
        </div>

        {/* 3 карточки правил */}
        <div className="space-y-2.5 pt-2">
          
          <div className="p-3.5 rounded-2xl bg-zine-card border border-zine-border shadow-zine-sm flex gap-3 items-start">
            <div className="w-9 h-9 rounded-xl bg-zine-terracotta/15 text-zine-terracotta flex items-center justify-center shrink-0">
              <HeartHandshake size={20} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-zine-ink leading-tight">
                Строго без дейтинга
              </h3>
              <p className="text-[11.5px] text-zine-inkMuted mt-0.5 leading-snug">
                Никакого флирта и свиданий. Только друзья, прогулки по городу, выставки и кофе. За намеки на дейтинг — бан.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-zine-card border border-zine-border shadow-zine-sm flex gap-3 items-start">
            <div className="w-9 h-9 rounded-xl bg-zine-sage/15 text-zine-sage flex items-center justify-center shrink-0">
              <EyeOff size={20} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-zine-ink leading-tight">
                Безопасность адреса
              </h3>
              <p className="text-[11.5px] text-zine-inkMuted mt-0.5 leading-snug">
                Мы автоматически смещаем геопозицию на 300–500м. Твой точный дом или подъезд никто никогда не увидит.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-zine-card border border-zine-border shadow-zine-sm flex gap-3 items-start">
            <div className="w-9 h-9 rounded-xl bg-zine-mustard/20 text-[#B87C24] flex items-center justify-center shrink-0">
              <Coffee size={20} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-zine-ink leading-tight">
                Легкость общения
              </h3>
              <p className="text-[11.5px] text-zine-inkMuted mt-0.5 leading-snug">
                Пиши в Telegram прямо и по делу: «Привет, увидел в YesMinsk, идем за кофе в Осмоловку?».
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Кнопка согласия */}
      <div className="pt-6 pb-2 space-y-3">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-zine-inkMuted">
          <Check size={14} className="text-zine-sage" />
          <span>Нажимая кнопку, ты подтверждаешь правила YesMinsk</span>
        </div>

        <button
          onClick={handleAgreeClick}
          className="w-full py-3.5 px-5 rounded-2xl bg-zine-terracotta hover:bg-zine-terracottaHover text-white font-semibold text-sm shadow-zine active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span>Я всё понял, согласен</span>
          <span>→</span>
        </button>
      </div>

    </div>
  );
};
