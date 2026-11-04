import React, { useState } from 'react';
import { FundBar, useFund, rub } from './FundBar';
import { Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { STAR_AMOUNTS, DONATE_LINKS, SHELTERS_URL } from '../../config/donate';

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

/**
 * Окно «Поддержать проект»: шкала сборов, переводы приютам (/sent в боте),
 * звёзды Telegram и другие способы (если заданы в config/donate.ts)
 */
export const DonateSheet: React.FC<{ onClose: () => void; onOpenNews?: () => void }> = ({ onClose, onOpenNews }) => {
  const [busyStars, setBusyStars] = useState<number | null>(null);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fund = useFund();

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
          Твоя поддержка помогает «ГУЛЯЙ!» оставаться бесплатным, а больше половины суммы уйдёт приютам для животных и на кофе организаторам сходок. Это очень ценно.
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
        Привет! ГУЛЯЙ! бесплатный и без рекламы. Больше донатов – больше помощи животным, кофе организаторам сходок и проекту (создаю его я один, Миша Спасатель Позднев, не программист и не дизайнер).
      </p>

      {/* Сколько уже собрано */}
      <FundBar className="mt-4" fund={fund} />

      {/* Переводы приютам и волонтёрам: последний, сколько всего и сколько кофе разыграли */}
      <div className="mt-3 p-4 rounded-zine bg-zine-card">
        <p className="text-body font-bold text-zine-ink">Каждую неделю – новому приюту или волонтёрам 🐾</p>
        {fund?.lastTransfer && (
          <div className="mt-3 p-3 rounded-zine-sm bg-zine-cardElevated">
            <p className="text-cap text-zine-inkMuted">Последний перевод · {dayMonth(fund.lastTransfer.at)}</p>
            <p className="text-body text-zine-ink">
              <b className="text-zine-terracotta">{rub(fund.lastTransfer.amount)}</b> → {fund.lastTransfer.to}
            </p>
          </div>
        )}
        {Boolean(fund?.sent || fund?.coffee) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="p-3 rounded-zine-sm bg-zine-cardElevated">
              <p className="text-body font-bold text-zine-ink">🐾 {rub(fund?.sent || 0)}</p>
              <p className="text-cap text-zine-inkMuted">передал всего</p>
            </div>
            <div className="p-3 rounded-zine-sm bg-zine-cardElevated">
              <p className="text-body font-bold text-zine-ink">☕ {fund?.coffee || 0}</p>
              <p className="text-cap text-zine-inkMuted">кофе разыграл организаторам</p>
            </div>
          </div>
        )}
        <button
          onClick={() => telegramService.openLink(SHELTERS_URL)}
          className="mt-3 w-full p-3 rounded-zine-sm bg-zine-cardElevated flex items-center gap-2 text-left text-body font-bold text-zine-terracotta cursor-pointer active:scale-[0.99] transition-transform"
        >
          <span className="flex-1">Список приютов</span>
          <ExternalLink size={20} className="shrink-0" />
        </button>
        <p className="mt-2 text-cap text-zine-inkMuted">Его мы составили вместе. Помогать можно и напрямую.</p>
      </div>

      <h4 className="mt-6 text-lead font-bold text-zine-ink">Вот здесь можешь сделать донат.</h4>

      {DONATE_LINKS.length > 0 && (
        <div className="mt-2 space-y-2">
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

      {/* Обещание прозрачности */}
      <div className="mt-5 p-4 rounded-zine bg-zine-sage/15 flex gap-3">
        <span className="text-[24px] leading-none">📸</span>
        <p className="min-w-0 text-sm2 text-zine-ink">
          <b>Всё прозрачно.</b> Чеки переводов и куда потратил — в{' '}
          <span className="whitespace-nowrap">
            «
            {onOpenNews ? (
              <button onClick={onOpenNews} className="font-bold text-zine-sage underline cursor-pointer">
                Новостях проекта
              </button>
            ) : (
              'Новостях проекта'
            )}
            ».
          </span>
        </p>
      </div>

    </BottomSheet>
  );
};
