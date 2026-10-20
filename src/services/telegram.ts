export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

const tg = () => {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
};

// Цвет фона приложения для светлой и тёмной темы (совпадает с --c-paper в index.css)
const PAPER = { light: '#FAF7F2', dark: '#1C1917' };

/**
 * Светлая или тёмная тема: берём из Telegram, а в обычном браузере — из настроек системы
 */
const applyTheme = () => {
  const webapp = tg();
  // Скрипт Telegram загружен и в обычном браузере, но реальная тема есть только внутри Telegram
  const insideTelegram = Boolean(webapp?.initData);
  const isDark = insideTelegram
    ? webapp!.colorScheme === 'dark'
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  document.documentElement.classList.toggle('dark', Boolean(isDark));

  if (webapp) {
    try {
      const color = isDark ? PAPER.dark : PAPER.light;
      webapp.setHeaderColor(color as any);
      webapp.setBackgroundColor(color as any);
    } catch {
      // старые версии Telegram не умеют менять цвет шапки
    }
  }
};

export const telegramService = {
  isAvailable(): boolean {
    return Boolean(tg());
  },

  init() {
    applyTheme();
    const webapp = tg();
    if (!webapp?.initData) {
      window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
      return;
    }

    try {
      webapp.ready();
      webapp.expand();                  // Раскрыть окно на всю высоту
      webapp.enableClosingConfirmation(); // Подтверждение закрытия при свайпе вниз

      // Переключаем тему вместе с Telegram
      webapp.onEvent('themeChanged', applyTheme);
    } catch (e) {
      console.warn('Telegram WebApp init warning:', e);
    }
  },

  getUser(): TelegramUser | null {
    const webapp = tg();
    if (webapp?.initDataUnsafe?.user) {
      return webapp.initDataUnsafe.user as TelegramUser;
    }
    // Фолбэк для разработки в обычном браузере на ПК
    return {
      id: 999001,
      first_name: 'Алексей',
      last_name: 'Минчанин',
      username: 'minsk_stroller',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
    };
  },

  getInitData(): string {
    return tg()?.initData || '';
  },

  haptic(type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error') {
    const webapp = tg();
    if (!webapp?.HapticFeedback) return;

    try {
      if (type === 'selection') {
        webapp.HapticFeedback.selectionChanged();
      } else if (['light', 'medium', 'heavy'].includes(type)) {
        webapp.HapticFeedback.impactOccurred(type as 'light' | 'medium' | 'heavy');
      } else {
        webapp.HapticFeedback.notificationOccurred(type as 'success' | 'warning' | 'error');
      }
    } catch {
      // Игнорируем на устройствах без поддержки виброотклика
    }
  },

  openChat(username?: string) {
    if (!username) return;
    const cleanUsername = username.replace(/^@/, '');
    const url = `https://t.me/${cleanUsername}`;
    
    const webapp = tg();
    if (webapp?.openTelegramLink) {
      webapp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
};
