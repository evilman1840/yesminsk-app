import React, { useEffect, useState } from 'react';
import { onServerWaking } from '../../services/api';

// Добрые сообщения, пока бесплатный сервер просыпается
const MESSAGES = [
  '☕️ Сервер варит себе кофе — проснётся через пару секунд',
  '🚶 Минск просыпается, собираем людей рядом…',
  '🐢 Наш сервер немного вздремнул. Уже бежит!',
  '🌳 Пока ждём — самое время подумать, куда сходить сегодня',
  '🧣 Сервер надевает шарф и выходит на прогулку…',
  '🗺 Раскладываем карту Минска и ищем компанию для тебя'
];

export const ServerWakingBanner: React.FC = () => {
  const [isWaking, setIsWaking] = useState(false);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * MESSAGES.length));

  useEffect(() => onServerWaking(setIsWaking), []);

  // Меняем фразу каждые 4 секунды, пока ждём
  useEffect(() => {
    if (!isWaking) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 4000);
    return () => clearInterval(timer);
  }, [isWaking]);

  if (!isWaking) return null;

  return (
    <div className="absolute top-14 inset-x-3 z-50 p-3 rounded-2xl bg-zine-cardElevated/95 backdrop-blur border border-zine-border shadow-zine-float flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="w-8 h-8 shrink-0 rounded-full border-[3px] border-zine-terracotta/25 border-t-zine-terracotta animate-spin" />
      <div className="min-w-0">
        <p key={index} className="text-[12px] font-semibold text-zine-ink leading-snug animate-in fade-in duration-500">
          {MESSAGES[index]}
        </p>
        <p className="text-[10px] text-zine-inkMuted mt-0.5">
          Обычно это занимает до минуты. Спасибо, что ждёшь 💛
        </p>
      </div>
    </div>
  );
};
