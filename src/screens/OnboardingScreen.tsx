import React from 'react';
import { HeartHandshake, ShieldCheck, MessageCircle } from 'lucide-react';
import { telegramService } from '../services/telegram';
import { Logo } from '../components/ui/Logo';

interface OnboardingScreenProps {
  onAgree: () => void;
}

const RULES = [
  {
    Icon: HeartHandshake,
    color: 'bg-zine-terracotta/10 text-zine-terracotta',
    title: 'Только дружба',
    text: 'Прогулки, кофе, выставки и разговоры. Без флирта и свиданий.'
  },
  {
    Icon: ShieldCheck,
    color: 'bg-zine-sage/15 text-zine-sage',
    title: 'Твой адрес в безопасности',
    text: 'На карте метка смещена на 300–500 метров. Где ты живёшь, никто не узнает.'
  },
  {
    Icon: MessageCircle,
    color: 'bg-zine-mustard/15 text-zine-mustardInk',
    title: 'Пиши, когда оба хотите',
    text: 'Нажми 👋 на анкете. Если человек ответит тем же — сможете написать друг другу.'
  }
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onAgree }) => (
  <div className="flex flex-col h-full w-full bg-zine-paper overflow-y-auto px-6 pt-10 pb-6">
    <Logo size="lg" />

    <h1 className="mt-8 font-serif font-bold text-display text-zine-ink">
      Компания для прогулок и&nbsp;общения в&nbsp;Минске
    </h1>
    <p className="mt-3 text-lead text-zine-inkMuted">Находи людей рядом и собирайтесь вместе.</p>

    <div className="mt-8 space-y-5">
      {RULES.map(({ Icon, color, title, text }) => (
        <div key={title} className="flex gap-4 items-start">
          <div className={`w-14 h-14 rounded-zine-sm flex items-center justify-center shrink-0 ${color}`}>
            <Icon size={28} />
          </div>
          <div>
            <h3 className="text-lead font-bold text-zine-ink">{title}</h3>
            <p className="mt-1 text-body text-zine-inkMuted">{text}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-auto pt-10">
      <button
        onClick={() => {
          telegramService.haptic('medium');
          onAgree();
        }}
        className="w-full h-14 rounded-zine-sm bg-zine-terracotta hover:bg-zine-terracottaHover text-white text-lead font-bold shadow-zine active:scale-[0.98] transition-transform cursor-pointer"
      >
        Понятно, начнём
      </button>
      <p className="mt-3 text-cap text-zine-inkMuted text-center">Нажимая кнопку, ты соглашаешься с этими правилами</p>
    </div>
  </div>
);
