import React from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { HOME_TEXTS as T } from '../../texts/home';

/**
 * Совет добавить приложение на экран: кнопкой Telegram, где можно, иначе подсказка для Android или iPhone
 */
export const AddToHomeSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const canAdd = telegramService.canAddToHomeScreen();
  const platform = telegramService.platform();
  const hint = platform === 'android' ? T.android : platform === 'ios' ? T.ios : T.other;

  return (
    <BottomSheet title={T.title} onClose={onClose}>
      <p className="text-body text-zine-ink">{T.text}</p>
      <p className="mt-3 p-3 rounded-zine-sm bg-zine-card text-body text-zine-ink">{hint}</p>
      {canAdd && (
        <button
          onClick={() => {
            telegramService.haptic('selection');
            telegramService.addToHomeScreen();
            onClose();
          }}
          className="mt-4 w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold cursor-pointer active:scale-[0.99] transition-transform"
        >
          {T.button}
        </button>
      )}
      <button onClick={onClose} className="mt-2 w-full h-12 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-ink cursor-pointer">
        {canAdd ? T.later : T.done}
      </button>
    </BottomSheet>
  );
};
