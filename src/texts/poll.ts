// Опрос автора: подпись в шапке карты и шторка с вариантами и итогами
export const POLL_TEXTS = {
  headerPill: 'Нужен твой совет 🙏',
  notice: (question: string) => `🗳 ${question} Решаю вместе с вами`,
  noticeAction: 'Ответить',
  // После голоса — строка в шапке: какой вариант пока впереди
  leader: (what: string) => `Впереди → ${what}`,
  leaderTie: 'пока поровну',
  leaderIdeas: 'ваши идеи',
  title: 'Опрос',
  custom: 'Свой вариант',
  customPlaceholder: 'Напиши свою идею',
  pickHint: 'Можно отметить несколько',
  send: (n: number) => (n > 1 ? `Отправить (${n})` : 'Отправить'),
  pickFirst: 'Отметь хотя бы один вариант',
  votes: (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word = mod10 === 1 && mod100 !== 11 ? 'голос' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'голоса' : 'голосов';
    return `${n.toLocaleString('ru-RU')} ${word}`;
  },
  thanks: 'Спасибо за голос!',
  counted: 'учтён',
  mine: 'твой выбор',
  ownIdeas: 'Свои идеи',
  myIdea: (text: string) => `Твоя идея: «${text}»`,
  donateNote: 'Решаю вместе с вами. Итоги и что сделал — напишу в новостях, а донаты помогают сделать это быстрее.',
  donate: 'Поддержать',
  revote: 'Изменить выбор',
  done: 'Готово'
};
