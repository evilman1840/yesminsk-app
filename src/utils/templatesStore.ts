import { api } from '../services/api';
import { EventTemplate } from '../types';

/**
 * Шаблоны сходок грузим один раз за запуск: нужны ленте сходок, «Хочу сходить» и карточке места
 */
let cache: EventTemplate[] | null = null;
let loading: Promise<EventTemplate[]> | null = null;

export const cachedTemplates = () => cache;

export const loadTemplates = () => {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = api
      .getEventTemplates()
      .then((list) => (cache = list || []))
      .catch(() => {
        loading = null; // попробуем ещё раз при следующем открытии
        return [];
      });
  }
  return loading;
};
