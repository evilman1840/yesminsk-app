import { EventTemplate, TemplateField, CUSTOM_TEMPLATE, AppEvent } from '../types';
import { MEETUP_TEXTS } from '../texts/meetups';

/**
 * Шаблоны сходок: подстановка доп. полей в название и описание, подбор шаблонов под место, быстрое время
 */

// Что подставить вместо {метки}: у вариантов с «say» — фраза, иначе название варианта или текст
const tokenValue = (field: TemplateField, extras: Record<string, string>) => {
  const v = extras[field.key] || field.default || '';
  if (!v) return '';
  if (field.type === 'select') {
    const opt = field.options?.find((o) => o.value === v);
    if (!opt) return '';
    if (v === 'other' && field.allowCustom) return extras[`${field.key}Custom`] || '';
    return opt.say ?? opt.label;
  }
  return v;
};

const fill = (text: string, fields: TemplateField[], extras: Record<string, string>) => {
  let missing = false;
  const result = text.replace(/\{([^}]+)\}/g, (_, token) => {
    const field = fields.find((f) => f.token === token);
    const value = field ? tokenValue(field, extras) : '';
    if (!value) missing = true;
    return value;
  });
  return { result: result.replace(/\s{2,}/g, ' ').trim(), missing };
};

// Название: если нужное поле не заполнено — запасное («Идём в кино»)
export const templateTitle = (tpl: EventTemplate, extras: Record<string, string>) => {
  const { result, missing } = fill(tpl.title, tpl.fields, extras);
  return missing && tpl.fallbackTitle ? tpl.fallbackTitle : result;
};

export const templateDescription = (tpl: EventTemplate, extras: Record<string, string>) => fill(tpl.description, tpl.fields, extras).result;

// Значения полей по умолчанию («Любой» уровень)
export const defaultExtras = (tpl: EventTemplate) =>
  Object.fromEntries(tpl.fields.filter((f) => f.default).map((f) => [f.key, f.default!])) as Record<string, string>;

// Для места: шаблоны его типа; если тип ни к одному не подходит — все. «Своя идея» всегда
export const templatesForPlace = (templates: EventTemplate[], placeType?: string) => {
  if (!placeType) return templates;
  const matching = templates.filter((t) => t.key !== CUSTOM_TEMPLATE && t.placeTypes.includes(placeType));
  if (!matching.length) return templates;
  return [...matching, ...templates.filter((t) => t.key === CUSTOM_TEMPLATE)];
};

// Значение для <input type="datetime-local"> в местном времени
export const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const at = (base: Date, addDays: number, hour: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// Ближайший день недели (6 — суббота, 0 — воскресенье): сегодня, если ещё не поздно, иначе через неделю
const nextWeekday = (now: Date, weekday: number, hour: number) => {
  let add = (weekday - now.getDay() + 7) % 7;
  if (add === 0 && now.getHours() >= hour - 1) add = 7;
  return at(now, add, hour);
};

export type QuickTimeId = keyof typeof MEETUP_TEXTS.quickTimes;
export const EVENING_HOUR = 19;
export const DAY_HOUR = 14;

// Быстрые кнопки над выбором даты; «Сегодня вечером» — пока до вечера больше часа
export const quickTimes = (now = new Date()): { id: QuickTimeId; label: string; date: Date }[] => {
  const list: { id: QuickTimeId; date: Date }[] = [];
  if (now.getHours() < EVENING_HOUR - 1) list.push({ id: 'todayEvening', date: at(now, 0, EVENING_HOUR) });
  list.push({ id: 'tomorrowEvening', date: at(now, 1, EVENING_HOUR) });
  list.push({ id: 'saturday', date: nextWeekday(now, 6, DAY_HOUR) });
  list.push({ id: 'sunday', date: nextWeekday(now, 0, DAY_HOUR) });
  return list.map((q) => ({ ...q, label: MEETUP_TEXTS.quickTimes[q.id] }));
};

// «when» из ссылки бота: weekend / today / tomorrow / saturday / sunday
export const quickTimeFromParam = (when?: string | null) => {
  if (!when) return null;
  const id = ({ weekend: 'saturday', today: 'todayEvening', tomorrow: 'tomorrowEvening', saturday: 'saturday', sunday: 'sunday' } as Record<string, QuickTimeId>)[when];
  return quickTimes().find((q) => q.id === id)?.date || (id === 'todayEvening' ? quickTimes()[0].date : null);
};

// Большой значок сходки: выбранный вариант (🏓 Настольный теннис), иначе значок шаблона; null — взять у категории
export const eventTemplateEmoji = (ev: AppEvent, templates?: EventTemplate[] | null) => {
  const tpl = templates?.find((t) => t.key === ev.templateId);
  if (!tpl || tpl.key === CUSTOM_TEMPLATE) return null;
  for (const f of tpl.fields) {
    const opt = f.type === 'select' && ev.extras?.[f.key] ? f.options?.find((o) => o.value === ev.extras![f.key]) : null;
    if (opt?.emoji) return opt.emoji;
  }
  return tpl.emoji;
};
