/**
 * «Хочу сходить»: тексты приложения. Правила: на «ты», нейтрально по роду, без длинных тире
 */
const people = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'человек' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'человека' : 'человек'}`;

export const WISH_TEXTS = {
  barTitle: 'Хочу сходить',
  barPrompt: 'Нет подходящей сходки? Отметь, куда хочется',
  barCounter: (n: number, what: string, when: string) => `${people(n)} ${n === 1 ? 'хочет' : 'хотят'} ${what} ${when}`,
  // Моё желание: сколько ещё хотят того же, кроме меня
  barCounterMine: (n: number, what: string, when: string) => `Ещё ${people(n)} ${n === 1 ? 'хочет' : 'хотят'} ${what} ${when}, как и ты`,
  noticeWho: 'Кто? →',
  noticeMeToo: 'И ты? →',
  barAll: 'Все',
  barAllMine: (n: number) => `Все · мои ${n}`,
  allLink: '🙋 Все желания и мои →',
  barMine: (n: number) => (n === 1 ? 'Твоё желание отмечено, ждём совпадений' : `Твоих желаний: ${n}, ждём совпадений`),

  sheetTitle: 'Куда хочется?',
  sheetHint: 'Без обязательств. Когда найдутся люди с таким же желанием, бот предложит собрать сходку.',
  whatLabel: 'Что',
  sportLabel: 'Во что играем?',
  customChip: 'Своё',
  customLabel: 'Чего хочется?',
  customPlaceholder: 'Например: караоке, йога, сапы',
  customHint: 'Совпадёт с теми, кто напишет то же самое. Коротко, одним-двумя словами.',
  whenLabel: 'Когда',
  whereLabel: 'Где (можно не выбирать)',
  anywhere: '📍 Где угодно',
  pickPlace: 'Выбрать место',
  placeSearch: 'Найти место',
  noPlaces: 'Ничего не нашлось',
  windows: { today: 'Сегодня', tomorrow: 'Завтра', weekend: 'На выходных', week: 'На неделе' },
  submit: '🙋 Хочу!',

  created: 'Готово! Как только найдутся ещё люди с таким же желанием, бот вас познакомит с идеей сходки 🙌',
  toastTitle: '🙋 Желание отмечено!',
  toastText: 'Когда найдутся люди с таким же желанием, бот напишет в Telegram и предложит собрать сходку. Ничего делать не нужно.',
  sameCount: (n: number) => `Ещё ${people(n)} ${n === 1 ? 'хочет' : 'хотят'} то же самое.`,

  othersTitle: 'Уже хотят',
  othersHint: 'Нажми, чтобы увидеть, кто это, передать 👋 или позвать в компанию',
  meToo: '✓ и ты',
  mineTitle: 'Мои желания',
  matched: (n: number) => `совпало: вас уже ${n}`,
  cancel: 'Убрать желание',
  limit: (max: number) => `Можно держать до ${max} желаний сразу`,

  placeCounter: (n: number, what: string, when: string) => `🙋 ${people(n)} ${n === 1 ? 'хочет' : 'хотят'} сюда ${what} ${when}`,
  placeWant: '🙋 Хочу сюда',
  emptyWant: '🙋 Отметить, куда хочется',
  failed: 'Не получилось, попробуй ещё раз',
  membersTitle: '🙋 Кто ещё хочет',
  // Шторка «Тоже хотят» из карточки в «Людях»
  kindTitle: (emoji: string, name: string) => `${emoji} Тоже хотят: ${name}`,
  kindHint: 'Передай 👋 или отметь галочкой нескольких и позови в компанию: бот пришлёт им приглашение от тебя.',
  kindBuild: '🛠 Собрать сходку для всех',
  inviteBuild: (n: number) => `Позвать ${n} в компанию →`,
  inviteLimit: (max: number) => `Можно позвать до ${max} человек сразу`,
  invitePick: (name: string) => `Позвать ${name} в компанию`,
  hello: 'Передать 👋',
  helloSent: '👋 передан',
  helloMatch: 'На связи: открыть анкету',
  meTooButton: '🙋 Я тоже хочу',
  meTooDone: '✓ Ты тоже в списке',
  // В форме сходки: кого позовём
  inviteLine: (names: string) => `👋 Позовём: ${names}. Бот пришлёт им приглашение от тебя, когда опубликуешь.`,
  inviteRemove: 'Не звать',
  kindOpenEvent: 'Сходку уже собрали, открыть',
  kindEmpty: 'Пока никого: желание уже исполнилось или его сняли.',
  membersHint: 'Эти люди отметили то же желание. Нажми на человека, чтобы открыть анкету и передать 👋.',
  membersEvent: '🎉 Сходку уже собрали: открыть',
  placeTitle: '📍 Где собраться?',
  placeHint: 'Место ещё не выбрали. Вставь ссылку из Яндекс Карт или напиши название и адрес, и бот предложит всем это место и время.',
  placePlaceholder: 'Например: Художественный дом Угринович, Раковская 25',
  placeHowTo: 'Ссылка: открой место в Яндекс Картах → «Поделиться» → «Скопировать».',
  placeSend: 'Предложить',
  placeFailed: 'Не получилось, попробуй ещё раз',
  placeChosen: (name: string) => `📍 Место: ${name}. Варианты времени придут в бот.`,
  membersGone: 'Пока никого не видно: желания могли отменить или анкеты скрыты.'
};

// Счётчик для баннера и шапки списка: в моём желании — «Ещё 47 … как и ты», в чужом — «48 человек хотят …»
export const wishCounter = (w: { count: number; what: string; when: string; includesMe: boolean }) =>
  w.includesMe ? WISH_TEXTS.barCounterMine(w.count - 1, w.what, w.when) : WISH_TEXTS.barCounter(w.count, w.what, w.when);

// Строка подсказок: мои желания, где есть ещё люди (до двух, где больше людей), а нет таких — одно самое популярное.
// Одно и то же желание в разных местах — один раз
export const wishNotices = <W extends { kind: string; sport: string | null; timeWindow: string; count: number; includesMe: boolean }>(summary: W[]): W[] => {
  const others = (w: W) => w.count - (w.includesMe ? 1 : 0);
  const sorted = summary
    .filter((w) => others(w) > 0)
    .sort((a, b) => others(b) - others(a))
    .filter((w, i, all) => all.findIndex((x) => x.kind === w.kind && x.sport === w.sport && x.timeWindow === w.timeWindow) === i);
  const mine = sorted.filter((w) => w.includesMe).slice(0, 2);
  return mine.length ? mine : sorted.slice(0, 1);
};

export const wishLine = (w: { what: string; when: string }) => `${w.what} ${w.when}`;
