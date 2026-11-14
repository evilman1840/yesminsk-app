import { AppEvent } from '../types';
import { api } from '../services/api';
import { telegramService } from '../services/telegram';
import { MEETUP_TEXTS } from '../texts/meetups';

// Сходка изменилась в одной из шторок — App обновляет её в списках и в открытой по ссылке
export const EVENT_UPDATED = 'yesminsk:event-updated';
// Организатор нажал «Изменить» в подробной карточке (карта, места, ссылка): App откроет форму на вкладке «Сходки»
export const EVENT_EDIT = 'yesminsk:event-edit';

// «Повторить»: та же дорога, что у «Изменить», но форма откроется для новой сходки с этими же данными и датой через неделю
export const repeatEvent = (event: AppEvent) => window.dispatchEvent(new CustomEvent<AppEvent>(EVENT_EDIT, { detail: { ...event, repeat: true } }));

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
