import React from 'react';
import { HeartHandshake, ShieldCheck, Cake } from 'lucide-react';
import { telegramService } from '../services/telegram';
import { Logo } from '../components/ui/Logo';
import { useMainButton } from '../hooks/useTelegram';

interface OnboardingScreenProps {
  onAgree: () => void;
}

// Что внутри — три вкладки приложения
const FEATURES = [
  {
    emoji: '📍',
    color: 'bg-zine-sage/15',
    title: 'Места по настроению',
    text: 'Куда сходить: соло, компанией или с детьми'
  },
  {
    emoji: '🗓',
    color: 'bg-zine-terracotta/10',
    title: 'Сходки',
    text: 'Прогулки, кофе, настолки. Или собери свою'
  },
  {
    emoji: '👋',
    color: 'bg-zine-mustard/15',
    title: 'Люди рядом',
    text: 'Пишите, когда оба нажали «Пообщаться»'
  }
];

// Правила — коротко, но обязательно
const RULES = [
  { Icon: Cake, text: 'Только 18+. Заметили кого-то младше? Пожалуйтесь на анкету' },
  { Icon: HeartHandshake, text: 'Только дружба: без флирта и свиданий' },
  { Icon: ShieldCheck, text: 'Метка на карте смещена на 300-500 м, где ты живёшь, никто не узнает' }
];

/**
 * Первый экран для новичка: о чём приложение и два правила
 */
export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onAgree }) => {
  const hasNativeAgree = useMainButton({ text: 'Выходим гулять!', onClick: onAgree });
  return (
  <div className="flex flex-col h-full w-full bg-zine-paper overflow-y-auto px-6 pt-7">
    <Logo size="lg" withTagline />

    <h1 className="mt-6 font-serif font-bold text-display text-zine-ink">Куда сходить в&nbsp;Минске и&nbsp;с&nbsp;кем</h1>
    <p className="mt-2 text-lead text-zine-inkMuted">Места, сходки и люди рядом в одном приложении.</p>

    <div className="mt-5 space-y-3">
      {FEATURES.map(({ emoji, color, title, text }) => (
        <div key={title} className="flex gap-4 items-center">
          <div className={`w-12 h-12 rounded-zine-sm flex items-center justify-center shrink-0 text-[24px] leading-none ${color}`}>{emoji}</div>
          <div className="min-w-0">
            <h3 className="text-lead font-bold text-zine-ink">{title}</h3>
            <p className="text-body text-zine-inkMuted">{text}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-5 p-4 rounded-zine bg-zine-card space-y-2.5">
      {RULES.map(({ Icon, text }) => (
        <p key={text} className="flex gap-3 items-start text-sm2 text-zine-ink">
          <Icon size={20} className="shrink-0 mt-0.5 text-zine-terracotta" />
          <span>{text}</span>
        </p>
      ))}
    </div>

    {/* Кнопка всегда видна внизу: в Telegram — нативная MainButton, в браузере — своя */}
    <div className="sticky bottom-0 mt-auto -mx-6 px-6 pt-5 pb-6 bg-gradient-to-t from-zine-paper via-zine-paper to-zine-paper/0">
      {!hasNativeAgree && (
      <button
        onClick={() => {
          telegramService.haptic('medium');
          onAgree();
        }}
        className="w-full h-14 rounded-zine-sm bg-zine-terracotta active:bg-zine-terracottaHover text-white text-lead font-bold shadow-zine active:scale-[0.98] transition-transform cursor-pointer"
      >
        Выходим гулять!
      </button>
      )}
      <p className="mt-3 text-cap text-zine-inkMuted text-center">Нажимая кнопку, ты соглашаешься с правилами выше</p>
    </div>
  </div>
);
};
