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
  // Где выбранное место: район и расстояние, чтобы не перепутать часть города
  fromYou: (d: string) => `${d} от тебя`,
  placeChange: 'Сменить',
  areaMismatch: (mentioned: string, area: string | null, km: number) =>
    `В описании ${mentioned}, а точка ${area ? `в районе «${area}», ` : ''}в ${km} км оттуда. Всё верно?`,
  areaMismatchOk: 'Да, верно',
  legalVenueHint: 'Собираемся в кафе, антикафе, музеях, кино, коворкингах и на спортплощадках. В парке тоже можно, небольшой компанией: погулять, побегать, попить кофе, поныть, общаться и дружить. Без политики и символики!',
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

  // Модератор удаляет чужую сходку
  adminDelete: '🛡 Удалить сходку (модератор)',
  adminDeleteTitle: 'Удалить сходку',
  adminDeleteHint: (title: string) => `«${title}» удалится насовсем. Организатору придёт сообщение с твоим текстом, участникам, что сходка отменена.`,
  adminDeletePlaceholder: 'Почему удалена (увидит организатор)',
  adminDeleteSend: 'Удалить и отправить',
  adminDeleteFailed: 'Не получилось удалить сходку',

  // Участие: «Точно приду» из напоминаний и «Не пойду» на карточке
  notGoing: 'Не пойду',
  notGoingConfirm: (title: string) => `Не пойдёшь на «${title}»? Место освободится, организатор увидит, что ты не придёшь.`,
  notGoingOk: 'Не пойду',
  confirmedMine: '✅ Ты точно придёшь, организатор это видит',
  confirmGo: '✅ Точно приду',
  confirmFailed: 'Не получилось отметить, попробуй ещё раз',
  confirmedOne: 'точно придёт',
  confirmedBadge: 'Точно придёт',

  // Для кого: пол и возраст (по желанию)
  audienceGenderLabel: 'Пол',
  audienceAll: 'Неважно',
  audienceFemale: '👩 Только девушки',
  audienceMale: '👨 Только мужчины',
  audienceNoGender: 'Чтобы собрать только девушек или только мужчин, укажи свой пол в анкете.',
  audienceAgeLabel: 'Возраст (можно не указывать)',
  audienceAgeFrom: 'от 18',
  audienceAgeTo: 'до 99',
  audienceHint: 'Кому не подходит, тот не увидит сходку в ленте.',

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

// Призыв к сходкам в строке подсказок
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Длинное название сходки обрезаем: в строке подсказок две строки
const short = (title: string) => (title.length > 24 ? `${title.slice(0, 23).trimEnd()}…` : title);
export const MAP_CALLOUT_TEXTS = {
  today: 'сегодня в',
  tomorrow: 'завтра в',
  weekday: ['в воскресенье в', 'в понедельник в', 'во вторник в', 'в среду в', 'в четверг в', 'в пятницу в', 'в субботу в'],
  // Время — в начале: если строка не влезет, обрежется название, а не когда
  friend: (name: string, title: string, when: string) => `🤝 ${cap(when)} ${name} идёт на «${short(title)}»`,
  event: (emoji: string, title: string, when: string) => `${emoji} ${cap(when)}: «${short(title)}»`,
  empty: '🌙 В ближайшие дни тихо. Собери сходку, и люди подтянутся',
  createOwn: '✨ Не нашлось подходящей? Собери свою, это минута',
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
