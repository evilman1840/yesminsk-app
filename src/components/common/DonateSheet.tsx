import React, { useState } from 'react';
import { FundBar } from './FundBar';
import { Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { STAR_AMOUNTS, DONATE_LINKS } from '../../config/donate';

/**
 * Окно «Поддержать проект»: звёзды Telegram и другие способы (если заданы в config/donate.ts)
 */
export const DonateSheet: React.FC<{ onClose: () => void; onOpenNews?: () => void }> = ({ onClose, onOpenNews }) => {
  const [busyStars, setBusyStars] = useState<number | null>(null);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyValue = async (value: string) => {
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
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  };

  const donateStars = async (stars: number) => {
    setError(null);
    setBusyStars(stars);
    try {
      const { url } = await api.createDonateInvoice(stars);
      const status = await telegramService.openInvoice(url);
      if (status === 'paid') {
        telegramService.haptic('success');
        setThanks(true);
      }
    } catch (err: any) {
      setError(err.message || 'Не получилось открыть оплату');
    } finally {
      setBusyStars(null);
    }
  };

  if (thanks) {
    return (
      <BottomSheet title="Спасибо! 💛" onClose={onClose}>
        <p className="text-body text-zine-ink">
          Твоя поддержка помогает «ГУЛЯЙ!» оставаться бесплатным, а больше половины суммы вернётся людям подарками и приятными сюрпризами. Это очень ценно.
        </p>
        <button onClick={onClose} className="mt-5 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
          Пожалуйста!
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Поддержать проект" onClose={onClose}>
      <p className="text-lead font-bold text-zine-ink">🔥 Поддержи проект 1 рублём или больше</p>
      <p className="mt-2 text-body text-zine-ink">
        Привет! Я Миша Спасатель Позднев, автор «ГУЛЯЙ!». Приложение бесплатное и без рекламы, и я хочу, чтобы донаты возвращались к людям.
      </p>

      {/* Сколько уже собрано */}
      <FundBar className="mt-4" />

      {/* Куда идут деньги: 51% — людям, 49% — на проект */}
      <div className="mt-4 p-4 rounded-zine bg-zine-card">
        <div className="space-y-2.5">
          <p className="flex gap-3">
            <span className="shrink-0 w-14 text-lead font-bold text-zine-terracotta">51%</span>
            <span className="text-sm2 text-zine-ink">
              <b>Обещаю: на вас.</b> Бесплатные подарки пользователям приложения: кофе на сходках, билеты в кино и на выставки и другие приятные сюрпризы 🎁
            </span>
          </p>
          <p className="flex gap-3">
            <span className="shrink-0 w-14 text-lead font-bold text-zine-sage">49%</span>
            <span className="text-sm2 text-zine-inkMuted">Серверы, развитие приложения и зарплата людям, которые его ведут.</span>
          </p>
        </div>
      </div>

      {/* Обещание прозрачности */}
      <div className="mt-3 p-4 rounded-zine bg-zine-sage/15 flex gap-3">
        <span className="text-[24px] leading-none">📸</span>
        <div className="min-w-0">
          <p className="text-sm2 text-zine-ink">
            <b>Всё прозрачно.</b> Раз в 2 недели выкладываю скриншоты всех донатов и рассказываю, кому достались подарки. Всё это в «Новостях проекта».
          </p>
          {onOpenNews && (
            <button onClick={onOpenNews} className="mt-2 text-sm2 font-bold text-zine-sage underline cursor-pointer">
              Смотреть отчёты →
            </button>
          )}
        </div>
      </div>

      {DONATE_LINKS.length > 0 && (
        <div className="mt-5 space-y-2">
          {DONATE_LINKS.map((link) => {
            const isCopied = Boolean(link.copy) && copied === link.copy;
            return (
              <button
                key={link.title}
                onClick={() => (link.url ? telegramService.openLink(link.url) : link.copy && copyValue(link.copy))}
                className="w-full p-3.5 rounded-zine-sm bg-zine-card flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
              >
                <span className="text-[26px] leading-none">{link.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-body font-bold text-zine-ink">{link.title}</span>
                  <span className={`block text-sm2 text-zine-inkMuted ${link.copy ? 'break-all' : ''}`}>{isCopied ? 'Скопировано ✓' : link.hint}</span>
                </span>
                {link.url ? (
                  <ExternalLink size={20} className="text-zine-inkMuted shrink-0" />
                ) : isCopied ? (
                  <Check size={20} strokeWidth={3} className="text-zine-sage shrink-0" />
                ) : (
                  <Copy size={20} className="text-zine-inkMuted shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <h4 className="mt-6 mb-2 text-body font-bold text-zine-ink">⭐ Или звёздами Telegram</h4>
      <div className="grid grid-cols-2 gap-2">
        {STAR_AMOUNTS.map((stars) => (
          <button
            key={stars}
            onClick={() => donateStars(stars)}
            disabled={busyStars !== null}
            className="h-14 rounded-zine-sm bg-zine-mustard/15 border border-zine-mustard/30 text-zine-ink text-lead font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
          >
            {busyStars === stars ? <Loader2 size={22} className="animate-spin" /> : `⭐ ${stars}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-cap text-zine-inkMuted">
        Звёзды можно купить прямо в Telegram во время оплаты.
      </p>

      {error && <p className="mt-3 p-3 rounded-zine-sm bg-zine-danger/10 text-sm2 text-zine-danger">{error}</p>}

    </BottomSheet>
  );
};
