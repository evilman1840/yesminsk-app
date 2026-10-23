import { useEffect, useRef } from 'react';
import { telegramService } from '../services/telegram';

/**
 * Нативная MainButton Telegram для главного действия экрана.
 * Возвращает true, если кнопка нарисована Telegram, — тогда свою HTML-кнопку не показываем.
 * В обычном браузере возвращает false: экран рисует запасную кнопку сам.
 */
export function useMainButton(opts: {
  text: string;
  onClick: () => void;
  enabled?: boolean;
  loading?: boolean;
  active?: boolean; // false — кнопка на этом экране сейчас не нужна
}): boolean {
  const { text, onClick, enabled = true, loading = false, active = true } = opts;
  const isNative = telegramService.isInsideTelegram();
  const handler = useRef(onClick);
  handler.current = onClick;
  const binding = useRef<ReturnType<typeof telegramService.bindMainButton> | null>(null);

  useEffect(() => {
    if (!isNative || !active) return;
    binding.current = telegramService.bindMainButton({ text, enabled, loading }, () => handler.current());
    return () => {
      binding.current?.dispose();
      binding.current = null;
    };
    // текст и состояние обновляет эффект ниже — здесь только подписка
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, active]);

  useEffect(() => {
    binding.current?.update({ text, enabled, loading });
  }, [text, enabled, loading]);

  return isNative;
}

/**
 * Нативная кнопка «Назад» Telegram. null — на этом экране её нет.
 * Открытые поверх шторки перехватывают «Назад» первыми (стек обработчиков).
 */
export function useBackButton(onBack: (() => void) | null) {
  const handler = useRef(onBack);
  handler.current = onBack;
  const active = onBack !== null;

  useEffect(() => {
    if (!active) return;
    return telegramService.pushBackHandler(() => handler.current?.());
  }, [active]);
}

/** Подтверждение закрытия Mini App, пока на экране есть несохранённые данные */
export function useClosingConfirmation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    return telegramService.guardClosing();
  }, [enabled]);
}
