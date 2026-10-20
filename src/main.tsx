import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { telegramService } from './services/telegram';

// Светлая/тёмная тема — до первого кадра, чтобы экран не мигал
telegramService.applyTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
