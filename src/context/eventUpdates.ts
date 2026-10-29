import { AppEvent } from '../types';
import { api } from '../services/api';
import { telegramService } from '../services/telegram';
import { MEETUP_TEXTS } from '../texts/meetups';

// Сходка изменилась в одной из шторок — App обновляет её в списках и в открытой по ссылке
export const EVENT_UPDATED = 'yesminsk:event-updated';

/**
 * «✅ Точно приду» из приложения. Вернёт обновлённую сходку или null, если не получилось
 */
export async function confirmAttendance(event: AppEvent): Promise<AppEvent | null> {
  try {
    const fresh = await api.confirmEvent(String(event.id));
    const updated = { ...event, ...fresh, id: event.id };
    telegramService.haptic('success');
    window.dispatchEvent(new CustomEvent<AppEvent>(EVENT_UPDATED, { detail: updated }));
    return updated;
  } catch (e: any) {
    telegramService.alert(e?.message || MEETUP_TEXTS.confirmFailed);
    return null;
  }
}
