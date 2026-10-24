/**
 * «Хочу сходить»: тексты приложения. Правила: на «ты», нейтрально по роду, без длинных тире
 */
const people = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'человек' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'человека' : 'человек'}`;

export const WISH_TEXTS = {
  barTitle: 'Хочу сходить',
  barPrompt: 'Нет подходящей сходки? Отметь, куда хочется',
  barCounter: (n: number, what: string, when: string) => `${people(n)} ${n === 1 ? 'хочет' : 'хотят'} ${what} ${when}`,
  barMine: (n: number) => (n === 1 ? 'Твоё желание отмечено, ждём совпадений' : `Твоих желаний: ${n}, ждём совпадений`),

  sheetTitle: 'Куда хочется?',
  sheetHint: 'Без обязательств. Когда найдутся люди с таким же желанием, бот предложит собрать сходку.',
  whatLabel: 'Что',
  sportLabel: 'Во что играем?',
  whenLabel: 'Когда',
  whereLabel: 'Где (можно не выбирать)',
  anywhere: '📍 Где угодно',
  pickPlace: 'Выбрать место',
  placeSearch: 'Найти место',
  noPlaces: 'Ничего не нашлось',
  windows: { today: 'Сегодня', tomorrow: 'Завтра', weekend: 'На выходных', week: 'На неделе' },
  submit: '🙋 Хочу!',

  created: 'Готово! Как только найдутся ещё люди с таким же желанием, бот вас познакомит с идеей сходки 🙌',
  sameCount: (n: number) => `Ещё ${people(n)} ${n === 1 ? 'хочет' : 'хотят'} то же самое.`,

  othersTitle: 'Уже хотят',
  othersHint: 'Нажми, чтобы хотеть того же',
  meToo: '✓ и ты',
  mineTitle: 'Мои желания',
  matched: (n: number) => `совпало: вас уже ${n}`,
  cancel: 'Убрать желание',
  limit: (max: number) => `Можно держать до ${max} желаний сразу`,

  placeCounter: (n: number, what: string, when: string) => `🙋 ${people(n)} ${n === 1 ? 'хочет' : 'хотят'} сюда ${what} ${when}`,
  placeWant: '🙋 Хочу сюда',
  emptyWant: '🙋 Отметить, куда хочется',
  failed: 'Не получилось, попробуй ещё раз'
};

export const wishLine = (w: { what: string; when: string }) => `${w.what} ${w.when}`;
