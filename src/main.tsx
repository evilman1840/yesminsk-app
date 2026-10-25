import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { telegramService } from './services/telegram';

// Светлая/тёмная тема — до первого кадра, чтобы экран не мигал
telegramService.applyTheme();

// Фото не загрузилось (например, человек сменил фото в Telegram и старая ссылка умерла) —
// вместо значка «сломанная картинка» тёплая заглушка с первой буквой имени (alt)
const fallbackImage = (name: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#E9DFD3"/><text x="200" y="250" font-size="170" font-family="Georgia, serif" font-weight="700" text-anchor="middle" fill="#B5462A">${(name.trim()[0] || '🙂').toUpperCase().replace(/[<&>]/g, '')}</text></svg>`
  )}`;
document.addEventListener(
  'error',
  (e) => {
    const img = e.target as HTMLImageElement;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = fallbackImage(img.alt || '');
  },
  true
);
// Та же картинка получила новый адрес и он загрузился — заглушка снова доступна для следующей ошибки
document.addEventListener(
  'load',
  (e) => {
    const img = e.target as HTMLImageElement;
    if (!(img instanceof HTMLImageElement) || img.src.startsWith('data:image/svg+xml')) return;
    // Telegram на умершую ссылку отдаёт пустую картинку 1×1 — тоже заглушка
    if (img.naturalWidth <= 2 && img.naturalHeight <= 2) {
      img.dataset.fallback = '1';
      img.src = fallbackImage(img.alt || '');
      return;
    }
    if (img.dataset.fallback) delete img.dataset.fallback;
  },
  true
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
