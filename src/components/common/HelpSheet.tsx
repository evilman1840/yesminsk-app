import React from 'react';
import { BottomSheet } from '../ui/BottomSheet';

const HELP_STEPS = [
  { emoji: '🗺', title: 'Люди и сходки рядом', text: 'На карте видно, кто рядом и какие встречи скоро. Нажми на фото, и откроется анкета.' },
  { emoji: '👋', title: '«Пообщаться»', text: 'Передай человеку привет. Если в ответ тоже нажмут 👋, вы сможете написать друг другу в Telegram.' },
  { emoji: '⚡', title: '«Хочу сейчас»', text: 'Нажми ⚡ на карте справа, если можешь встретиться в ближайшие 3 часа: твою анкету покажут в начале списка.' },
  { emoji: '🧭', title: '«Покажут город»', text: 'Приехали в Минск? Местные жители с радостью покажут город. А если живёшь здесь, включи «Покажу город» в анкете.' },
  { emoji: '📍', title: '«Места»', text: 'Переключи карту на «Места» и выбери настроение, Миша подскажет, куда сходить. Оставляй свои советы!' },
  { emoji: '🗓', title: 'Сходки', text: 'Присоединяйся к прогулкам и встречам или собери свою компанию, это займёт минуту.' },
  { emoji: '✏️', title: 'Твоя анкета', text: 'Во вкладке «Я» добавь фото и пару слов о себе, так тебя быстрее заметят.' },
  { emoji: '🛡', title: 'Безопасно', text: 'Твоя метка на карте смещена на 500-800 м, и её можно передвинуть. Можно включить режим невидимки.' }
];

/**
 * «Как это работает» — для тех, кто здесь впервые. Открывается из «Я»
 */
export const HelpSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <BottomSheet title="Как это работает" onClose={onClose}>
    <div className="space-y-4">
      {HELP_STEPS.map((step) => (
        <div key={step.title} className="flex gap-3.5">
          <span className="w-12 h-12 shrink-0 rounded-zine-sm bg-zine-card flex items-center justify-center text-[24px]">{step.emoji}</span>
          <div>
            <p className="text-body font-bold text-zine-ink">{step.title}</p>
            <p className="text-sm2 text-zine-inkMuted mt-0.5">{step.text}</p>
          </div>
        </div>
      ))}
    </div>
    <button onClick={onClose} className="mt-6 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
      Понятно
    </button>
  </BottomSheet>
);
