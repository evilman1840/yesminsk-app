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

const BOT = import.meta.env.VITE_BOT_USERNAME || 'yesminsk_app_bot';

// Что показать в окне «Поделиться» (его рисует App, слушая это событие)
export interface ShareData {
  title: string;
  text: string;
  link: string;
}
export const SHARE_EVENT = 'yesminsk:share';
const openShare = (data: ShareData) => window.dispatchEvent(new CustomEvent<ShareData>(SHARE_EVENT, { detail: data }));

// Цвета приложения для светлой и тёмной темы (совпадают с --c-* в index.css)
const PAPER = { light: '#FAF7F2', dark: '#1C1917' };
const BAR = { light: '#FFFDF9', dark: '#2E2A26' };          // --c-card-elevated: фон под MainButton
const TERRACOTTA = { light: '#D95C3C', dark: '#E8714F' };   // --c-terracotta: цвет MainButton

// Внутри Telegram? Скрипт грузится и в обычном браузере, но initData есть только в Telegram
const insideTelegram = () => Boolean(tg()?.initData);
const isDarkNow = () => document.documentElement.classList.contains('dark');

// ── Ссылка «собрать сходку» ───────────────────────────────────────────────
export interface CreateMeetupLink {
  template?: string; // ключ шаблона: coffee, sport…
  when?: string;     // today / tomorrow / saturday / sunday / weekend
  placeId?: string;
  wishGroupId?: string; // «Соберу я» из «Хочу сходить»
  opt?: string;         // вид спорта
}
const WHEN_PARAMS = ['today', 'tomorrow', 'saturday', 'sunday', 'weekend'];

// create_coffee_weekend_<id места>: части по порядку, любую можно пропустить
export const parseCreateParam = (param: string): CreateMeetupLink => {
  const link: CreateMeetupLink = {};
  param.split('_').slice(1).forEach((part) => {
    if (/^[a-f0-9]{24}$/i.test(part)) link.placeId = part;
    else if (WHEN_PARAMS.includes(part)) link.when = part;
    else if (/^[a-z0-9]+$/i.test(part) && !link.template) link.template = part.toLowerCase();
  });
  return link;
};

// ── MainButton ─────────────────────────────────────────────────────────────
export interface MainButtonState {
  text: string;
  visible?: boolean;
  enabled?: boolean;
  loading?: boolean;
}
// Стек: шторка поверх экрана перехватывает кнопку, после закрытия возвращается кнопка экрана
interface MainButtonBinding {
  state: MainButtonState;
  onClick: () => void;
}
const mainStack: MainButtonBinding[] = [];
let mainListenerBound = false;
const topMain = () => mainStack[mainStack.length - 1];

const onTelegramMain = () => {
  const top = topMain();
  if (!top || top.state.loading || top.state.enabled === false) return;
  telegramService.haptic('medium');
  top.onClick();
};

const paintMainButton = () => {
  const webapp = tg();
  if (!webapp || !insideTelegram()) return;
  const b = webapp.MainButton;
  if (!mainListenerBound) {
    b.onClick(onTelegramMain);
    mainListenerBound = true;
  }
  const s = topMain()?.state;
  if (!s || s.visible === false) {
    b.hideProgress();
    b.hide();
    return;
  }
  const enabled = s.enabled !== false && !s.loading;
  const dark = isDarkNow();
  b.setParams({
    text: s.text,
    color: TERRACOTTA[dark ? 'dark' : 'light'],
    text_color: '#FFFFFF',
    is_active: enabled,
    is_visible: true
  });
  if (s.loading) b.showProgress(false);
  else b.hideProgress();
};

// ── BackButton: стек обработчиков. Верхний (последний открытый экран/шторка) получает «Назад» ──
const backStack: Array<() => void> = [];
let backListenerBound = false;

const onTelegramBack = () => {
  const top = backStack[backStack.length - 1];
  if (!top) return;
  telegramService.haptic('light');
  top();
};

const syncBackButton = () => {
  const webapp = tg();
  if (!webapp || !insideTelegram()) return;
  if (!backListenerBound) {
    webapp.BackButton.onClick(onTelegramBack);
    backListenerBound = true;
  }
  if (backStack.length) webapp.BackButton.show();
  else webapp.BackButton.hide();
};

// ── Подтверждение закрытия: включено, пока открыт хоть один экран с несохранёнными данными ──
let closingGuards = 0;
const syncClosingConfirmation = () => {
  const webapp = tg();
  if (!webapp || !insideTelegram()) return;
  if (closingGuards > 0) webapp.enableClosingConfirmation();
  else webapp.disableClosingConfirmation();
};

// Тема, которую человек выбрал сам кнопкой ☀️/🌙 (иначе — как в Telegram)
// Тема: как в Telegram (по умолчанию) или выбранная вручную в профиле
const THEME_KEY = 'yesminsk_theme_pref';
type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'auto' | ThemeMode;

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
  const inTelegram = insideTelegram();
  const saved = getSavedTheme();
  const isDark = saved
    ? saved === 'dark'
    : inTelegram
    ? webapp!.colorScheme === 'dark'
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  document.documentElement.classList.toggle('dark', Boolean(isDark));

  if (webapp && inTelegram) {
    const mode = isDark ? 'dark' : 'light';
    if (webapp.isVersionAtLeast('6.1')) {
      webapp.setHeaderColor(PAPER[mode]);
      webapp.setBackgroundColor(PAPER[mode]);
    }
    if (webapp.isVersionAtLeast('7.10')) webapp.setBottomBarColor(BAR[mode]);
    paintMainButton(); // цвет кнопки — под новую тему
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
      webapp.expand(); // Раскрыть окно на всю высоту
      // Карта, шторки и карусель тянутся по вертикали — свайп вниз не должен сворачивать приложение
      if (webapp.isVersionAtLeast('7.7')) webapp.disableVerticalSwipes();

      // Переключаем тему вместе с Telegram
      webapp.onEvent('themeChanged', applyTheme);
    } catch (e) {
      console.warn('Telegram WebApp init warning:', e);
    }
  },

  /** Внутри Telegram (а не в обычном браузере) — тогда есть MainButton, BackButton и попапы */
  isInsideTelegram(): boolean {
    return insideTelegram();
  },

  /**
   * Нативная MainButton: кладёт кнопку на верх стека.
   * update — поменять текст/загрузку, dispose — убрать (вернётся кнопка экрана ниже или скроется)
   */
  bindMainButton(state: MainButtonState, onClick: () => void): { update: (s: MainButtonState) => void; dispose: () => void } {
    const binding: MainButtonBinding = { state, onClick };
    mainStack.push(binding);
    paintMainButton();
    return {
      update(next) {
        binding.state = next;
        if (topMain() === binding) paintMainButton();
      },
      dispose() {
        const i = mainStack.lastIndexOf(binding);
        if (i !== -1) mainStack.splice(i, 1);
        paintMainButton();
      }
    };
  },

  /** Нативная «Назад»: обработчик кладётся на верх стека. Возвращает функцию, снимающую его */
  pushBackHandler(handler: () => void): () => void {
    backStack.push(handler);
    syncBackButton();
    return () => {
      const i = backStack.lastIndexOf(handler);
      if (i !== -1) backStack.splice(i, 1);
      syncBackButton();
    };
  },

  /** «Точно закрыть?» при свайпе/крестике, пока есть несохранённые данные */
  guardClosing(): () => void {
    closingGuards += 1;
    syncClosingConfirmation();
    return () => {
      closingGuards = Math.max(0, closingGuards - 1);
      syncClosingConfirmation();
    };
  },

  /** Сообщение в окне Telegram (в браузере — обычный alert) */
  alert(message: string, kind: 'error' | 'info' = 'error'): Promise<void> {
    if (kind === 'error') telegramService.haptic('error');
    const webapp = tg();
    const text = message.slice(0, 256);
    if (!webapp || !insideTelegram() || !webapp.isVersionAtLeast('6.2')) {
      window.alert(text);
      return Promise.resolve();
    }
    return new Promise((resolve) => webapp.showAlert(text, () => resolve()));
  },

  /** Подтверждение в окне Telegram. destructive — красная кнопка для удаления */
  confirm(message: string, opts: { okText?: string; destructive?: boolean } = {}): Promise<boolean> {
    if (opts.destructive) telegramService.haptic('warning');
    const webapp = tg();
    const text = message.slice(0, 256);
    if (!webapp || !insideTelegram() || !webapp.isVersionAtLeast('6.2')) {
      return Promise.resolve(window.confirm(text));
    }
    return new Promise((resolve) =>
      webapp.showPopup(
        {
          message: text,
          buttons: [
            { id: 'cancel', type: 'cancel' },
            opts.destructive
              ? { id: 'ok', type: 'destructive', text: opts.okText || 'Удалить' }
              : { id: 'ok', type: 'default', text: opts.okText || 'OK' }
          ]
        },
        (id) => resolve(id === 'ok')
      )
    );
  },

  getUser(): TelegramUser | null {
    const webapp = tg();
    if (webapp?.initDataUnsafe?.user) {
      return webapp.initDataUnsafe.user as TelegramUser;
    }
    // Фолбэк только для разработки в обычном браузере на ПК
    if (!import.meta.env.DEV) return null;
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
  getThemePreference(): ThemePreference {
    return getSavedTheme() || 'auto';
  },

  // Выбор темы в профиле: 'auto' — как в Telegram
  setThemePreference(pref: ThemePreference) {
    try {
      if (pref === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
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
   * «Позвать на сходку»: открывает окно «Поделиться» со ссылкой-приглашением.
   * Ссылка ведёт в бота, он присылает карточку сходки с кнопкой «Открыть сходку»
   */
  shareEvent(event: { id: string; title: string; dateTime: string }) {
    const when = new Date(event.dateTime).toLocaleString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    openShare({
      title: 'Позвать на сходку',
      text: `Пойдём вместе? «${event.title}», ${when} 👋`,
      link: `https://t.me/${BOT}?start=event_${event.id}`
    });
  },

  /**
   * «Позвать друзей»: личная ссылка-приглашение в приложение.
   * Бот встретит друга словами «<имя> зовёт тебя в ДА! МИНСК», а пригласившему придёт спасибо
   */
  shareApp() {
    const me = this.getUser();
    openShare({
      title: 'Позвать друзей',
      text: 'Пошли со мной в ДА! МИНСК: там легко найти компанию для прогулок, кофе и выставок в Минске 👋',
      link: me?.id ? `https://t.me/${BOT}?start=invite_${me.id}` : `https://t.me/${BOT}`
    });
  },

  // Отправить ссылку в чат Telegram (выбор чата)
  shareToTelegram(link: string, text: string) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    const webapp = tg();
    if (webapp?.initData && webapp.openTelegramLink) webapp.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  },

  /**
   * Что открыть при запуске: сходку по ссылке (?event=<id>) или вкладку (?tab=events)
   */
  getLaunchTarget(): { eventId?: string; tab?: string; placeId?: string; create?: CreateMeetupLink; want?: { placeId?: string }; userId?: string; wishGroupId?: string } {
    const params = new URLSearchParams(window.location.search);
    const startParam = tg()?.initDataUnsafe?.start_param || '';
    const eventId = params.get('event') || (startParam.startsWith('event_') ? startParam.slice(6) : '') || undefined;
    // Собрать сходку: ?create=coffee&when=weekend&place=<id> (кнопки бота) или startapp=create_coffee_weekend_<id> (ссылки в постах)
    const create = params.has('create')
      ? {
          template: params.get('create') || undefined,
          when: params.get('when') || undefined,
          placeId: params.get('place') || undefined,
          wishGroupId: params.get('wish') || undefined,
          opt: params.get('opt') || undefined
        }
      : startParam.startsWith('create') ? parseCreateParam(startParam) : undefined;
    // «Хочу сходить» из сообщения бота: ?want=1&place=<id>
    const want = params.get('want') === '1' ? { placeId: params.get('place') || undefined } : undefined;
    return {
      eventId,
      tab: params.get('tab') || undefined,
      placeId: create || want ? undefined : params.get('place') || undefined,
      create,
      want,
      userId: params.get('user') || undefined, // «Посмотреть анкету» из «хочет пообщаться»
      wishGroupId: params.get('wishGroup') || undefined // «Кто ещё хочет» из «Хочу сходить»
    };
  },

  /**
   * Открыть оплату звёздами. Возвращает 'paid', 'cancelled', 'failed' или 'pending'
   */
  openInvoice(url: string): Promise<string> {
    const webapp = tg();
    return new Promise((resolve) => {
      if (webapp?.initData && webapp.isVersionAtLeast('6.1')) {
        webapp.openInvoice(url, (status) => resolve(status));
      } else {
        window.open(url, '_blank');
        resolve('pending');
      }
    });
  },

  // Ярлык на экране телефона (Telegram 8.0+): можно ли добавить и добавлен ли уже
  platform(): string {
    return tg()?.platform || 'unknown';
  },
  canAddToHomeScreen(): boolean {
    const webapp: any = tg();
    return Boolean(webapp?.initData && webapp.isVersionAtLeast?.('8.0') && typeof webapp.addToHomeScreen === 'function');
  },
  addToHomeScreen() {
    const webapp: any = tg();
    if (this.canAddToHomeScreen()) webapp.addToHomeScreen();
  },
  // 'added' | 'missed' | 'unknown' | 'unsupported'
  homeScreenStatus(): Promise<string> {
    const webapp: any = tg();
    return new Promise((resolve) => {
      if (!this.canAddToHomeScreen() || typeof webapp.checkHomeScreenStatus !== 'function') return resolve('unsupported');
      try {
        webapp.checkHomeScreenStatus((status: string) => resolve(status));
      } catch {
        resolve('unknown');
      }
    });
  },

  // Закрыть мини-приложение (в браузере — ничего не делаем)
  close() {
    const webapp = tg();
    if (webapp?.initData && webapp.close) webapp.close();
  },

  openLink(url: string) {
    const webapp = tg();
    if (webapp?.initData && webapp.openLink) webapp.openLink(url);
    else window.open(url, '_blank');
  },

  openChat(username?: string) {
    if (!username) return;
    const cleanUsername = username.replace(/^@/, '');
    const url = `https://t.me/${cleanUsername}`;
    
    const webapp = tg();
    if (webapp?.initData && webapp.openTelegramLink) {
      webapp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
};
