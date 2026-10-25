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
  missingFields: (list: string) => `Осталось заполнить: ${list}`,
  fieldNames: { title: 'название', description: 'пару слов о встрече', place: 'где встречаемся', time: 'когда' } as Record<string, string>,
  placeNotFound: 'Не нашли этот адрес на карте. Выбери место из подсказок, нажми «Указать на карте» или «Я сейчас здесь».',
  customCategoryRequired: 'Напиши, что будете делать, например «Караоке»',
  saveFailed: 'Не получилось сохранить сходку, попробуй ещё раз',
  fromPlaces: 'Из «Мест»:',
  moneyFree: 'Бесплатно',
  moneySplit: 'Делим аренду',
  moneyAmountPlaceholder: 'Сколько BYN с человека',
  seatsHintPair: 'Для пары достаточно 2 мест, для пары на пару 4.',
  duration: (minutes: number) => `≈ ${String(Math.round((minutes / 60) * 10) / 10).replace('.', ',')} ч`,

  // Цена: по умолчанию бесплатно
  priceLabel: 'Сколько стоит?',
  priceFree: '💚 Бесплатно',
  pricePaid: '💸 Платно',
  priceAmountPlaceholder: 'Примерно сколько BYN с человека (можно не писать)',
  priceHint: 'Например, билет, аренда или вход. Чтобы никто не удивлялся на месте.',

  // «Поныть»
  supportRulesTitle: '🫂 Правила встречи подключатся сами',
  empathsDefaultHint: 'Метка «Только эмпаты» включена: придут те, кто умеет слушать. Можно выключить в «Для кого?».',

  // Пустая лента
  emptyTitle: 'Тут пока пусто',
  emptyText: 'Собери первую сходку, это займёт минуту.'
};

// Пометка цены сходки: «💚 Бесплатно», «💸 Платно», «💸 Платно, примерно 15 BYN»
export const priceLabel = (ev: { isPaid?: boolean; price?: number }) =>
  !ev.isPaid ? MEETUP_TEXTS.priceFree : ev.price ? `${MEETUP_TEXTS.pricePaid}, примерно ${String(ev.price).replace('.', ',')} BYN` : MEETUP_TEXTS.pricePaid;
export const priceShort = (ev: { isPaid?: boolean; price?: number }) =>
  !ev.isPaid ? 'бесплатно' : ev.price ? `~${String(ev.price).replace('.', ',')} BYN` : 'платно';
