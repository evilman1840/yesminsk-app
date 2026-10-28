/**
 * Пролистанные сходки (на устройстве): во «Все» показываем их после новых
 */
const SEEN_KEY = 'yesminsk_seen_events';
const BADGE_KEY = 'yesminsk_events_badge_seen';

export const loadSeenEvents = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

export const markEventSeen = (id: string) => {
  try {
    const seen = loadSeenEvents();
    if (seen.has(id)) return;
    seen.add(id);
    // Храним последние 300: прошедшие сходки всё равно уходят из ленты
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
  } catch {
    // без сохранения просто не переставим
  }
};

// Число на вкладке «Сходки»: какие сходки уже были в ленте, когда человек открывал вкладку
export const loadBadgeSeenEvents = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(BADGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

export const markBadgeSeenEvents = (ids: string[]): Set<string> => {
  const seen = loadBadgeSeenEvents();
  ids.forEach((id) => seen.add(id));
  try {
    localStorage.setItem(BADGE_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    // без сохранения число вернётся после перезапуска
  }
  return seen;
};
