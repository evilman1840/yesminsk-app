/**
 * Настройки доната.
 *
 * Карта — главная кнопка окна. ЕРИП, телефон и звёзды Telegram — под «Другие способы».
 */

// Список приютов и волонтёров, который составили вместе в опросе (ссылка в «Новостях проекта»)
export const SHELTERS_URL = 'https://clck.ru/3Wqp86';

// Сколько звёзд можно отправить (такой же список — на сервере)
export const STAR_AMOUNTS = [50, 100, 250, 500];

// Главная кнопка «💳 Поддержать картой»
// Своя сумма: человек вводит её в банке
export const CARD_URL = 'https://www.alfabank.by/share/?transferLinkId=697bdff3d6f242317b6e3cab&version=INSNC3';

// Перевод на карту с уже заданной суммой (рубли → ссылка Альфа-Банка)
export const CARD_URL_BY_RUB: Record<number, string> = {
  1: 'https://www.alfabank.by/share?transferLinkId=6af19be4ccaa0344c73ba4b8&version=INSNC3',
  5: 'https://www.alfabank.by/share?transferLinkId=6af19c4accaa0344c73ba4b9&version=INSNC3',
  10: 'https://www.alfabank.by/share?transferLinkId=6af19c61ccaa0344c73ba4ba&version=INSNC3',
  30: 'https://www.alfabank.by/share?transferLinkId=6af19c7bccaa0344c73ba4bb&version=INSNC3'
};

// Окно организатору после сходки со взносом: суммы в три раза больше обычных
export const HOST_CARD_URL_BY_RUB: Record<number, string> = {
  3: 'https://www.alfabank.by/share?transferLinkId=6af1c59accaa0344c73ba4db&version=INSNC3',
  15: 'https://www.alfabank.by/share?transferLinkId=6af1c5c52b121e1f5b5f45db&version=INSNC3',
  30: 'https://www.alfabank.by/share?transferLinkId=6af1c5f9ebe8c7414bb59793&version=INSNC3',
  90: 'https://www.alfabank.by/share?transferLinkId=6af1c5e2b7dee03105082959&version=INSNC3'
};

// «Другие способы»: реквизиты, копируются одним нажатием
export interface DonateCopy {
  emoji: string;
  title: string;  // «ЕРИП (Альфа-Банк), счёт»
  shown: string;  // как показываем
  copy: string;   // что копируем
}

export const DONATE_COPY: DonateCopy[] = [
  { emoji: '🏦', title: 'ЕРИП (Альфа-Банк), счёт', shown: 'BY81ALFA301432X3X40010270000', copy: 'BY81ALFA301432X3X40010270000' },
  { emoji: '📱', title: 'Перевод по номеру телефона', shown: '+375 29 588-14-72', copy: '+375295881472' }
];
