/**
 * «Хочу сходить»: тексты приложения. Правила: на «ты», нейтрально по роду, без длинных тире
 */
import { MeetupStats } from '../types';

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
  // Ссылка под счётчиком в «Сходках»
  barLink: (n: number) => (n ? `Все желания · мои ${n}` : 'Все желания'),
  allLink: '🙋 Все желания и мои →',
  // Строка быстрых желаний под карточкой: вид в одно нажатие
  quickOther: 'Своё',
  quickHint: 'Нажми, когда удобно, и готово',
  quickMore: 'Место и мои желания',
  // Карточка в ленте между сходками
  reelMeToo: '🙋 И я хочу',
  reelWho: 'Кто эти люди?',
  reelAsk: 'И ты?',
  // Подбадривание под «И ты?»: одна фраза на карточку
  cheers: [
    'Все приходят впервые и никого не знают. Это нормально',
    'Можно просто прийти и послушать, болтать не обязательно',
    'Не понравится, можно уйти через полчаса. Никто не обидится',
    'Компанией проще, чем кажется: тема для разговора уже есть',
    'Ничего организовывать не надо: бот сам предложит время и место',
    'Отметка ни к чему не обязывает: сначала бот спросит, удобно ли время'
  ],
  // Статистика: только настоящие числа с сервера
  statMeetups: (m: number, p: number) => `Уже прошло ${m} ${m % 10 === 1 && m % 100 !== 11 ? 'сходка' : [2, 3, 4].includes(m % 10) && ![12, 13, 14].includes(m % 100) ? 'сходки' : 'сходок'}, на них сходили ${people(p)}`,
  statExcellent: (k: number) => `${k} из 10 после сходки отвечают «😍 Отлично»`,
  statKept: (k: number) => `${k} из 10 после сходки остаются на связи с кем-то из компании`,
  // После «И я хочу»
  joinedCalm: 'Дальше ничего делать не нужно, бот напишет.',
  joinedUndo: 'Планы поменялись? Желание можно убрать в «Моих желаниях».',
  reelOpenMine: 'Мои желания →',
  reelPromptTitle: 'Не нашлось подходящей сходки?',
  reelPromptTitlePeople: 'Куда хочется сходить?',
  reelPromptText: 'Отметь, куда хочется. Когда найдутся люди с таким же желанием, бот предложит собрать компанию.',
  reelPromptButton: '🙋 Хочу сходить',
  // Пустая лента с фильтром: «🙋 Хочу на кофе завтра»
  emptyWantFor: (what: string, when: string) => `🙋 Хочу ${what} ${when}`.replace(/\s+/g, ' ').trim(),
  whenPhrase: { today: 'сегодня', tomorrow: 'завтра', weekend: 'на выходных', week: 'на неделе' } as Record<string, string>,
  // Что будет дальше: прогресс группы до предложения бота
  progressAlone: 'Пока только ты. Как найдётся ещё кто-то, бот напишет',
  progressSome: (n: number, of: number) => `Вас ${n} из ${of}. Ещё ${people(of - n)}, и бот предложит время и место`,
  progressFull: (n: number) => `Вас ${n}: бот предлагает время и место в Telegram`,
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

// Что будет дальше с желанием: «Пока только ты», «Вас 2 из 3…», «Вас 3: бот предлагает…»
export const wishProgress = (groupSize: number, proposeAt: number) =>
  groupSize < 2 ? WISH_TEXTS.progressAlone : groupSize < proposeAt ? WISH_TEXTS.progressSome(groupSize, proposeAt) : WISH_TEXTS.progressFull(groupSize);

// Фраза желания без метки поля: «поиграть в {спорт}» → «поиграть»
export const bareWishPhrase = (phrase: string) => phrase.replace(/\s*\S*\s*\{[^}]+\}/, '').trim();

// Чем подбодрить на карточке: настоящая статистика (когда её достаточно и она хорошая) и спокойные фразы
export const cheerLines = (stats?: MeetupStats | null) =>
  [
    stats?.meetups && stats.people ? WISH_TEXTS.statMeetups(stats.meetups, stats.people) : null,
    stats?.excellentOf10 && stats.excellentOf10 >= 6 ? WISH_TEXTS.statExcellent(stats.excellentOf10) : null,
    stats?.keptInTouchOf10 && stats.keptInTouchOf10 >= 2 ? WISH_TEXTS.statKept(stats.keptInTouchOf10) : null,
    ...WISH_TEXTS.cheers
  ].filter(Boolean) as string[];
