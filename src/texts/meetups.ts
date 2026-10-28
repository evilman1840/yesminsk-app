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
  pickPlaceHint: 'Нажми на место или впиши адрес ниже',
  addressPlaceholder: 'Или впиши адрес: улица и дом',
  moneyFree: 'Бесплатно',
  moneySplit: 'Делим аренду',
  moneyAmountPlaceholder: 'Сколько BYN с человека',
  seatsMinTwo: 'Ты тоже занимаешь место, поэтому мест минимум 2: ты и ещё один человек',
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

  mineChip: '⭐ Мои',
  mineEmptyTitle: 'Своих сходок пока нет',
  mineEmptyText: 'Здесь будут сходки, которые ты собираешь, и те, куда ты идёшь. Собери первую, это займёт минуту.',

  // Пустая лента
  emptyTitle: 'Тут пока пусто',
  emptyText: 'Собери первую сходку, это займёт минуту.'
};

// Пометка цены сходки: «💚 Бесплатно», «💸 Платно», «💸 Платно, примерно 15 BYN»
export const priceLabel = (ev: { isPaid?: boolean; price?: number }) =>
  !ev.isPaid ? MEETUP_TEXTS.priceFree : ev.price ? `${MEETUP_TEXTS.pricePaid}, примерно ${String(ev.price).replace('.', ',')} BYN` : MEETUP_TEXTS.pricePaid;
export const priceShort = (ev: { isPaid?: boolean; price?: number }) =>
  !ev.isPaid ? 'бесплатно' : ev.price ? `~${String(ev.price).replace('.', ',')} BYN` : 'платно';

// Призыв к сходкам на карте (одна строка над «Хочу сейчас»)
const meetupsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'сходка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'сходки' : 'сходок');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const MAP_CALLOUT_TEXTS = {
  today: 'сегодня в',
  tomorrow: 'завтра в',
  weekday: ['в воскресенье в', 'в понедельник в', 'во вторник в', 'в среду в', 'в четверг в', 'в пятницу в', 'в субботу в'],
  friend: (name: string, title: string, when: string) => `🤝 ${name} идёт на сходку «${title}» ${when}.`,
  event: (emoji: string, todayCount: number, title: string, when: string) =>
    todayCount > 1 ? `🗓 Сегодня ${todayCount} ${meetupsWord(todayCount)}. Например, «${title}» ${when.replace(/^сегодня /, '')}.` : `${emoji} ${cap(when)}: «${title}».`,
  empty: '🌙 В ближайшие дни тихо. Собери сходку, и люди подтянутся.',
  go: 'Пойдёшь? →',
  create: 'Собрать →',
  close: 'Скрыть до завтра'
};

// Сходки на карте: «На карте» / «Списком»
export const MAP_EVENTS_TEXTS = {
  onMap: 'На карте',
  asList: 'Списком',
  going: (n: number, max?: number) => `Идут: ${n}${max ? ` из ${max}` : ''}`,
  joined: 'Я иду'
};
