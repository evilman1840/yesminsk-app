import React, { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { STAR_AMOUNTS, DONATE_LINKS } from '../../config/donate';

/**
 * Окно «Поддержать проект»: звёзды Telegram и другие способы (если заданы в config/donate.ts)
 */
export const DonateSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [busyStars, setBusyStars] = useState<number | null>(null);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Твоя поддержка помогает ДА! МИНСК оставаться бесплатным и становиться лучше. Это очень ценно.
        </p>
        <button onClick={onClose} className="mt-5 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
          Пожалуйста!
        </button>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Поддержать проект" onClose={onClose}>
      <p className="text-body text-zine-inkMuted">
        ДА! МИНСК — бесплатный и без рекламы. Если приложение помогло найти компанию, можно сказать спасибо — любая сумма помогает оплачивать серверы и делать новое 💛
      </p>

      <h4 className="mt-5 mb-2 text-body font-bold text-zine-ink">⭐ Звёздами Telegram</h4>
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

      {DONATE_LINKS.length > 0 && (
        <>
          <h4 className="mt-6 mb-2 text-body font-bold text-zine-ink">Другие способы</h4>
          <div className="space-y-2">
            {DONATE_LINKS.map((link) => (
              <button
                key={link.url}
                onClick={() => telegramService.openLink(link.url)}
                className="w-full p-3.5 rounded-zine-sm bg-zine-card flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
              >
                <span className="text-[26px] leading-none">{link.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-body font-bold text-zine-ink">{link.title}</span>
                  <span className="block text-sm2 text-zine-inkMuted">{link.hint}</span>
                </span>
                <ExternalLink size={20} className="text-zine-inkMuted shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  );
};
