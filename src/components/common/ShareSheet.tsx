import React, { useState } from 'react';
import { Send, Copy, Check } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService, ShareData } from '../../services/telegram';

/**
 * Окно «Поделиться»: отправить в Telegram или скопировать ссылку (для Instagram, Threads, WhatsApp и т.д.)
 */
export const ShareSheet: React.FC<{ data: ShareData; onClose: () => void }> = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const value = `${data.text}\n${data.link}`;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // запасной способ для старых браузеров
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    telegramService.haptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <BottomSheet title={data.title} onClose={onClose}>
      <div className="p-4 rounded-zine-sm bg-zine-card">
        <p className="text-body text-zine-ink">{data.text}</p>
        <p className="mt-2 text-sm2 text-zine-terracotta break-all">{data.link}</p>
      </div>

      <div className="mt-4 space-y-2">
        <button
          onClick={() => {
            telegramService.haptic('selection');
            telegramService.shareToTelegram(data.link, data.text);
          }}
          className="w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <Send size={20} />
          <span>Отправить в Telegram</span>
        </button>
        <button
          onClick={copy}
          className={`w-full h-12 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all ${
            copied ? 'bg-zine-sage text-white' : 'bg-zine-card text-zine-ink'
          }`}
        >
          {copied ? <Check size={20} strokeWidth={3} /> : <Copy size={20} />}
          <span>{copied ? 'Скопировано — вставь куда удобно' : 'Скопировать ссылку'}</span>
        </button>
      </div>
      <p className="mt-3 text-cap text-zine-inkMuted text-center">Ссылку можно отправить в любой мессенджер, Instagram или Threads</p>
    </BottomSheet>
  );
};
