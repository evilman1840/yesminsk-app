import React, { useEffect, useState } from 'react';
import { onServerWaking } from '../../services/api';

// Добрые сообщения, пока бесплатный сервер просыпается
const MESSAGES = [
  '☕️ Сервер варит себе кофе, проснётся через пару секунд',
  '🚶 Минск просыпается, собираем людей рядом…',
  '🐢 Наш сервер немного вздремнул. Уже бежит!',
  '🌳 Пока ждём, самое время подумать, куда сходить сегодня',
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
    <div className="absolute top-20 inset-x-3 z-50 p-4 rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-float flex items-center gap-3.5">
      <div className="w-9 h-9 shrink-0 rounded-full border-[3px] border-zine-terracotta/25 border-t-zine-terracotta animate-spin" />
      <div className="min-w-0">
        <p key={index} className="text-body font-semibold text-zine-ink">
          {MESSAGES[index]}
        </p>
        <p className="text-sm2 text-zine-inkMuted mt-1">
          Обычно это занимает до минуты. Спасибо, что ждёшь 💛
        </p>
      </div>
    </div>
  );
};
