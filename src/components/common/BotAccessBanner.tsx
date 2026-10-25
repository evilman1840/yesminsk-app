import React, { useEffect, useState } from 'react';
import { askBotAccess, botAccessOk, onBotAccessChange } from '../../services/botAccess';
import { telegramService } from '../../services/telegram';

/**
 * «Включи сообщения от бота» — для тех, кто открыл приложение по ссылке и не разрешил боту писать
 */
export const BotAccessBanner: React.FC = () => {
  const [ok, setOk] = useState(botAccessOk());
  useEffect(() => onBotAccessChange(() => setOk(botAccessOk())), []);
  if (ok) return null;
  return (
    <section className="p-4 rounded-zine bg-zine-mustard/15 border border-zine-mustard/40">
      <p className="text-body font-bold text-zine-ink">🔔 Включи сообщения от бота</p>
      <p className="mt-1 text-sm2 text-zine-ink">Без них не придут напоминания о сходках, совпадения по «Хочу сходить» и приветы 👋.</p>
      <button
        type="button"
        onClick={async () => {
          telegramService.haptic('selection');
          if (await askBotAccess(true)) setOk(true);
        }}
        className="mt-3 h-11 px-5 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer active:scale-95 transition-transform"
      >
        Включить
      </button>
    </section>
  );
};
