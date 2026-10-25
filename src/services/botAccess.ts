import { telegramService } from './telegram';
import { api } from './api';

/**
 * Разрешение боту писать человеку. Открыли приложение по ссылке, минуя чат с ботом, — бот не может прислать
 * ни напоминаний, ни совпадений. Спрашиваем системным окном Telegram: при первом входе и перед действиями,
 * ради которых нужны сообщения (не чаще раза за запуск)
 */
let known: boolean | null = null;
let askedThisSession = false;
const listeners = new Set<(ok: boolean) => void>();

export const setBotAccessKnown = (ok: boolean) => {
  known = ok || telegramService.allowsWriteToPm();
  listeners.forEach((l) => l(Boolean(known)));
};
export const botAccessOk = () => Boolean(known) || telegramService.allowsWriteToPm() || !telegramService.canRequestWriteAccess();
export const onBotAccessChange = (fn: (ok: boolean) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// force — по кнопке «Включить» (даже если уже спрашивали)
export async function askBotAccess(force = false): Promise<boolean> {
  if (botAccessOk()) return true;
  if (askedThisSession && !force) return false;
  askedThisSession = true;
  const allowed = await telegramService.requestWriteAccess();
  if (allowed) {
    api.reportBotAccess(true).catch(() => {});
    setBotAccessKnown(true);
  }
  return allowed;
}
