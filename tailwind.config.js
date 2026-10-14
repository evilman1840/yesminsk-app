/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Фирменная палитра «Теплый зин» (YesMinsk)
        zine: {
          paper: '#FAF7F2',        // Фон небеленой бумаги
          card: '#F4EFEA',         // Карточки первого уровня
          cardElevated: '#FFFDF9', // Выделенные модалки / шторка
          border: '#E8DFD5',       // Тонкие тактильные границы
          ink: '#2B2623',          // Мягкий графитовый текст
          inkMuted: '#7A726B',     // Второстепенный текст
          terracotta: '#D95C3C',   // Главный акцент (кнопка действия, прогулка)
          terracottaHover: '#C64F30',
          mustard: '#E2A03F',      // Горчичный стикер (бар / кафе)
          sage: '#5B7B68',         // Шалфейный зеленый (природа / загород)
          blush: '#E88B74',        // Мягкий румянец (выставки / кино)
          cream: '#FCFAF6'
        }
      },
      fontFamily: {
        serif: ['"Lora"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      },
      boxShadow: {
        'zine-sm': '0 1px 3px rgba(43, 38, 35, 0.05), 0 1px 2px rgba(43, 38, 35, 0.03)',
        'zine': '0 4px 14px rgba(43, 38, 35, 0.07)',
        'zine-float': '0 8px 24px -4px rgba(43, 38, 35, 0.12), 0 2px 6px -1px rgba(43, 38, 35, 0.04)'
      },
      borderRadius: {
        'zine-sm': '12px',
        'zine': '18px',
        'zine-lg': '26px'
      }
    },
  },
  plugins: [],
};
