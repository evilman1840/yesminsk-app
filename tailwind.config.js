/** @type {import('tailwindcss').Config} */

// Цвет из CSS-переменной (значения — в src/index.css, отдельно для светлой и тёмной темы).
// Такая запись сохраняет прозрачность: bg-zine-terracotta/10 и т.п.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Фирменная палитра «Тёплый зин» (ДА! МИНСК)
        zine: {
          paper: v('paper'),               // Фон экрана
          card: v('card'),                 // Карточки первого уровня
          cardElevated: v('card-elevated'),// Выделенные карточки / шторки
          border: v('border'),             // Тонкие границы
          ink: v('ink'),                   // Основной текст
          inkMuted: v('ink-muted'),        // Второстепенный текст
          terracotta: v('terracotta'),     // Главный акцент
          terracottaHover: v('terracotta-hover'),
          mustard: v('mustard'),           // Кафе / бар
          mustardInk: v('mustard-ink'),    // Текст на горчичном фоне
          sage: v('sage'),                 // Природа / успех
          blush: v('blush'),
          plum: v('plum'),                 // Выставки / кино
          sky: v('sky'),                   // Спорт
          danger: v('danger'),
          cream: v('card-elevated')
        }
      },
      fontFamily: {
        serif: ['"Lora"', 'Georgia', 'serif'],
        hand: ['"Caveat"', 'cursive'], // рукописные подписи: «выходи гулять!»
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      },
      // Крупная шкала шрифтов — читается в любом возрасте
      fontSize: {
        cap: ['13px', '18px'],     // самые мелкие подписи
        sm2: ['15px', '21px'],     // второстепенный текст
        body: ['17px', '24px'],    // основной текст
        lead: ['19px', '26px'],    // имена, акценты
        title: ['22px', '28px'],   // заголовки карточек
        display: ['28px', '34px']  // заголовки экранов
      },
      boxShadow: {
        'zine-sm': '0 1px 3px rgba(43, 38, 35, 0.06), 0 1px 2px rgba(43, 38, 35, 0.04)',
        'zine': '0 4px 16px rgba(43, 38, 35, 0.08)',
        'zine-float': '0 10px 30px -6px rgba(43, 38, 35, 0.18), 0 2px 8px -2px rgba(43, 38, 35, 0.06)'
      },
      borderRadius: {
        'zine-sm': '14px',
        'zine': '20px',
        'zine-lg': '28px'
      }
    },
  },
  plugins: [],
};
