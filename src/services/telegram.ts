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

// Тема, которую человек выбрал сам кнопкой ☀️/🌙 (иначе — как в Telegram)
const THEME_KEY = 'yesminsk_theme';
type ThemeMode = 'light' | 'dark';

const getSavedTheme = (): ThemeMode | null => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
};

/**
 * Светлая или тёмная тема: выбор человека → тема Telegram → настройки системы (в обычном браузере)
 */
const applyTheme = () => {
  const webapp = tg();
  // Скрипт Telegram загружен и в обычном браузере, но реальная тема есть только внутри Telegram
  const insideTelegram = Boolean(webapp?.initData);
  const saved = getSavedTheme();
  const isDark = saved
    ? saved === 'dark'
    : insideTelegram
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

  // Применить тему сразу при запуске, до отрисовки экранов
  applyTheme() {
    applyTheme();
  },

  isDarkTheme(): boolean {
    return document.documentElement.classList.contains('dark');
  },

  // Переключение темы кнопкой ☀️/🌙 — выбор запоминается
  setTheme(mode: ThemeMode) {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // без сохранения тема просто вернётся к телеграмной при следующем запуске
    }
    applyTheme();
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

  /**
   * «Позвать друзей»: открывает выбор чата в Telegram со ссылкой-приглашением на сходку.
   * Ссылка ведёт в бота, он присылает карточку сходки с кнопкой «Открыть сходку»
   */
  shareEvent(event: { id: string; title: string; dateTime: string }) {
    const bot = import.meta.env.VITE_BOT_USERNAME || 'yesminsk_app_bot';
    const link = `https://t.me/${bot}?start=event_${event.id}`;
    const when = new Date(event.dateTime).toLocaleString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const text = `Пойдём вместе? «${event.title}», ${when} 👋`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

    const webapp = tg();
    if (webapp?.initData && webapp.openTelegramLink) {
      webapp.openTelegramLink(shareUrl);
    } else if (navigator.share) {
      navigator.share({ title: event.title, text, url: link }).catch(() => {});
    } else {
      window.open(shareUrl, '_blank');
    }
  },

  /**
   * Что открыть при запуске: сходку по ссылке (?event=<id>) или вкладку (?tab=events)
   */
  getLaunchTarget(): { eventId?: string; tab?: string } {
    const params = new URLSearchParams(window.location.search);
    const startParam: string = (tg()?.initDataUnsafe as any)?.start_param || '';
    const eventId = params.get('event') || (startParam.startsWith('event_') ? startParam.slice(6) : '') || undefined;
    return { eventId, tab: params.get('tab') || undefined };
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
