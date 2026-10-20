/**
 * Настройки доната.
 *
 * Звёзды Telegram работают сразу — для них ничего настраивать не нужно.
 * Другие способы (карта, Boosty, ЮMoney и т.п.) появятся в окне доната,
 * как только сюда будут добавлены ссылки. Пустой список — блок не показывается.
 */

// Сколько звёзд можно отправить (такой же список — на сервере)
export const STAR_AMOUNTS = [50, 100, 250, 500];

export interface DonateLink {
  emoji: string;
  title: string; // «Картой из Беларуси»
  hint: string;  // «Через Boosty, любая карта»
  url: string;
}

export const DONATE_LINKS: DonateLink[] = [
  // Пример:
  // { emoji: '🇧🇾', title: 'Картой из Беларуси', hint: 'Через …', url: 'https://…' },
  // { emoji: '🇷🇺', title: 'Картой из России', hint: 'Через Boosty', url: 'https://boosty.to/…' },
];
