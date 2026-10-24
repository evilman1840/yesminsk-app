/**
 * Тексты для сборки сходок: выбор шаблона, быстрое время, доп. поля, пустая лента.
 * Правила: на «ты», нейтрально по роду, без длинных тире
 */
export const MEETUP_TEXTS = {
  createButton: 'Собрать сходку',
  createButtonShort: 'Собрать',

  // Выбор шаблона
  pickTitle: 'Что соберём?',
  pickHint: 'Выбери идею, остальное заполним за тебя. Останется время и место.',
  pickForPlace: (place: string) => `Сходка: ${place}`,
  customHint: 'Пустая форма, всё как захочешь',
  changeTemplate: 'Сменить',
  newMeetup: 'Новая сходка',
  editMeetup: 'Изменить сходку',

  // Время
  whenLabel: 'Когда?',
  quickTimes: {
    todayEvening: 'Сегодня вечером',
    tomorrowEvening: 'Завтра вечером',
    saturday: 'Суббота днём',
    sunday: 'Воскресенье днём'
  },

  // Поля шаблона
  customOptionPlaceholder: 'Напиши своё',
  fieldRequired: (label: string) => `Заполни поле «${label}»`,
  moneyFree: 'Бесплатно',
  moneySplit: 'Делим аренду',
  moneyAmountPlaceholder: 'Сколько BYN с человека',
  seatsHintPair: 'Для пары достаточно 2 мест, для пары на пару 4.',
  duration: (minutes: number) => `≈ ${String(Math.round((minutes / 60) * 10) / 10).replace('.', ',')} ч`,

  // «Поныть»
  supportRulesTitle: '🫂 Правила встречи подключатся сами',
  empathsDefaultHint: 'Метка «Только эмпаты» включена: придут те, кто умеет слушать. Можно выключить в «Для кого?».',

  // Пустая лента
  emptyTitle: 'Тут пока пусто',
  emptyText: 'Собери первую сходку, это займёт минуту.'
};
