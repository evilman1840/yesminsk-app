// Опрос автора: подпись в шапке карты и шторка с вариантами и итогами
export const POLL_TEXTS = {
  headerLink: '🗳 Новый опрос →',
  title: 'Опрос',
  custom: 'Свой вариант',
  customPlaceholder: 'Например: книги в детский дом',
  sendIdea: 'Отправить идею',
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
  donateNote: 'Чем больше донатов, тем больше получит то, что выберете. Итоги и что сделал — напишу в новостях.',
  donate: 'Поддержать',
  revote: 'Изменить выбор',
  done: 'Готово'
};
