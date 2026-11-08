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
export const CARD_URL = 'https://www.alfabank.by/share/?transferLinkId=697bdff3d6f242317b6e3cab&version=INSNC3';

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
