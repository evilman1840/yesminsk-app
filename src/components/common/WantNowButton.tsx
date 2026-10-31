import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { formatTime } from '../../types';
import { WANT_NOW_TEXTS as T } from '../../texts/wantNow';

// На сколько часов включается «⚡ Хочу сейчас»
export const AVAILABLE_HOURS = 3;

// Сколько осталось: «2:41»
const leftText = (until: number) => {
  const min = Math.max(0, Math.ceil((until - Date.now()) / 60000));
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
};

/**
 * «⚡ Хочу сейчас» — круглая кнопка. Выключена: нажатие сначала объясняет, что будет, и включает из шторки.
 * Включена: зелёная, с остатком времени; нажатие — до скольки и «Выключить».
 * look: map — круглая с тенью на карте, people — в шапке «Людей»
 */
export const WantNowButton: React.FC<{
  availableUntil?: string | null;
  isVisible: boolean; // в режиме невидимки статус никто не увидит
  onSet: (hours: number) => Promise<void>;
  onOpenProfile: () => void;
  look: 'map' | 'people';
}> = ({ availableUntil, isVisible, onSet, onOpenProfile, look }) => {
  const until = availableUntil ? new Date(availableUntil).getTime() : 0;
  const [, tick] = useState(0);
  const isOn = until > Date.now();
  // Раз в минуту — обновить остаток и погаснуть, когда время вышло
  useEffect(() => {
    if (!isOn) return;
    const id = window.setInterval(() => tick((n) => n + 1), 60000);
    return () => window.clearInterval(id);
  }, [isOn]);

  const [sheet, setSheet] = useState<'info' | 'on' | 'hidden' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const change = async (hours: number) => {
    setIsSaving(true);
    try {
      await onSet(hours);
      setSheet(null);
    } catch (err: any) {
      telegramService.alert(err?.message || T.error);
    } finally {
      setIsSaving(false);
    }
  };

  const size = look === 'map' ? 'w-14 h-14' : 'w-11 h-11';
  const offLook = look === 'map' ? 'bg-zine-cardElevated border border-zine-border shadow-zine-float dark:bg-[#433C36] dark:border-white/25' : 'bg-zine-card';

  return (
    <>
      <button
        onClick={() => {
          telegramService.haptic('selection');
          setSheet(isOn ? 'on' : isVisible ? 'info' : 'hidden');
        }}
        aria-label={isOn ? T.onLabel(formatTime(availableUntil)) : T.label}
        className={`relative ${size} shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer ${
          isOn ? 'bg-[#2FA36B] shadow-zine-float' : offLook
        }`}
      >
        <span className={`${look === 'map' ? 'text-[26px]' : 'text-[22px]'} leading-none`}>⚡</span>
        {isOn && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-5 px-1.5 rounded-full bg-white text-[#1F7A4D] text-[12px] font-bold leading-5 tabular-nums shadow-zine-sm">
            {leftText(until)}
          </span>
        )}
      </button>

      {sheet === 'info' && (
        <BottomSheet title={T.infoTitle} onClose={() => setSheet(null)}>
          <div className="space-y-4">
            {T.infoSteps.map((item) => (
              <div key={item.title} className="flex gap-3.5">
                <span className="w-12 h-12 shrink-0 rounded-zine-sm bg-zine-card flex items-center justify-center text-[24px]">{item.emoji}</span>
                <div>
                  <p className="text-body font-bold text-zine-ink">{item.title}</p>
                  <p className="text-sm2 text-zine-inkMuted mt-0.5">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => change(AVAILABLE_HOURS)}
            className="mt-6 w-full h-14 rounded-zine-sm bg-[#2FA36B] text-white text-lead font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform"
          >
            {isSaving ? <Loader2 size={22} className="animate-spin" /> : T.turnOn}
          </button>
          <button onClick={() => setSheet(null)} className="mt-2 w-full h-12 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-ink cursor-pointer">
            {T.notNow}
          </button>
        </BottomSheet>
      )}

      {sheet === 'on' && (
        <BottomSheet title={T.onTitle} onClose={() => setSheet(null)}>
          <p className="text-body text-zine-inkMuted">{T.onText(formatTime(availableUntil))}</p>
          <button
            onClick={() => change(0)}
            className="mt-5 w-full h-12 rounded-zine-sm bg-zine-card text-body font-bold text-zine-ink flex items-center justify-center cursor-pointer"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : T.turnOff}
          </button>
        </BottomSheet>
      )}

      {sheet === 'hidden' && (
        <BottomSheet title={T.hiddenTitle} onClose={() => setSheet(null)}>
          <p className="text-body text-zine-inkMuted">{T.hiddenText}</p>
          <button
            onClick={() => {
              setSheet(null);
              onOpenProfile();
            }}
            className="mt-5 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer"
          >
            {T.openProfile}
          </button>
        </BottomSheet>
      )}
    </>
  );
};
