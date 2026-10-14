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

export const telegramService = {
  isAvailable(): boolean {
    return Boolean(tg());
  },

  init() {
    const webapp = tg();
    if (!webapp) return;

    try {
      webapp.ready();
      webapp.expand();                  // Раскрыть окно на всю высоту
      webapp.enableClosingConfirmation(); // Подтверждение закрытия при свайпе вниз

      // Окрашивание шапки Telegram в фирменный цвет бумаги
      webapp.setHeaderColor('#FAF7F2');
      webapp.setBackgroundColor('#FAF7F2');
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
