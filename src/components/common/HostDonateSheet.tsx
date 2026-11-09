import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { CARD_URL, DONATE_COPY, HOST_CARD_URL_BY_RUB } from '../../config/donate';
import { TierIcon } from '../ui/Pechka';
import { ThanksSheet } from './DonateSheet';
import { MEETUP_TEXTS as M } from '../../texts/meetups';

// Те же пирожки, что в обычном донате, но суммы в три раза больше: сходка со взносом
const TIERS = [
  { kind: 'one', name: 'Пирожок', rub: 3 },
  { kind: 'two', name: 'Тарелка', rub: 15 },
  { kind: 'basket', name: 'Корзинка', rub: 30 },
  { kind: 'loaf', name: 'Каравай', rub: 90 }
] as const;

const ERIP = DONATE_COPY[0];
// Счёт группами по 4, как в банке: читается легче и не рвётся посередине (копируем без пробелов)
const ERIP_SHOWN = ERIP.shown.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

/**
 * После публикации сходки со взносом организатору: честно отправить немного Печке ГУЛЯЙ.
 * Слово от Миши → четыре суммы → карта → ЕРИП (сразу на виду, через него переводят многие) → «Позже»
 */
export const HostDonateSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tier, setTier] = useState(1);
  const [copied, setCopied] = useState(false);
  const [thanks, setThanks] = useState(false);

  const copyErip = async () => {
    try {
      await navigator.clipboard.writeText(ERIP.copy);
    } catch {
      const area = document.createElement('textarea');
      area.value = ERIP.copy;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    telegramService.haptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (thanks) return <ThanksSheet onClose={onClose} />;

  const rub = TIERS[tier].rub;
  return (
    <BottomSheet title={M.hostDonateTitle} onClose={onClose}>
      <p className="text-body text-zine-ink">{M.hostDonateText}</p>
      <p className="mt-1.5 text-sm2 text-zine-inkMuted">{M.hostDonateSign}</p>

      <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Сколько пирожков">
        {TIERS.map((t, i) => (
          <button
            key={t.kind}
            onClick={() => {
              telegramService.haptic('selection');
              setTier(i);
            }}
            aria-pressed={tier === i}
            className={`py-1.5 px-1 rounded-zine-sm border-2 flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              tier === i ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-card'
            }`}
          >
            <span className="h-[30px] flex items-center">
              <TierIcon kind={t.kind} />
            </span>
            <span className="text-[12px] leading-tight text-zine-inkMuted text-center">{t.name}</span>
            <span className="text-sm2 font-bold text-zine-ink">{t.rub} р.</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => telegramService.openLink(HOST_CARD_URL_BY_RUB[rub] || CARD_URL)}
        className="mt-3 w-full min-h-14 py-2 rounded-zine-sm bg-zine-terracotta text-white cursor-pointer active:scale-[0.99] transition-transform"
      >
        <span className="block text-lead font-bold">{M.hostDonateBtn(rub)}</span>
        <span className="block text-cap font-medium opacity-90">{M.hostDonateBtnSub}</span>
      </button>
      <p className="mt-1.5 text-cap text-zine-inkMuted text-center">
        {M.hostDonateOwn}{' '}
        <button onClick={() => telegramService.openLink(CARD_URL)} className="font-semibold text-zine-terracotta underline underline-offset-2 cursor-pointer">
          {M.hostDonateOwnLink}
        </button>
      </p>

      {/* ЕРИП — сразу на виду: так переводят многие */}
      <button
        onClick={copyErip}
        className="mt-3 w-full p-3 rounded-zine-sm bg-zine-card flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
      >
        <span className="text-[24px] leading-none">{ERIP.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm2 font-bold text-zine-ink">{ERIP.title}</span>
          <span className="block text-sm2 text-zine-inkMuted">{copied ? 'Скопировано ✓' : ERIP_SHOWN}</span>
        </span>
        {copied ? <Check size={20} strokeWidth={3} className="text-zine-sage shrink-0" /> : <Copy size={20} className="text-zine-inkMuted shrink-0" />}
      </button>
      <p className="mt-1.5 text-cap text-zine-inkMuted">{M.hostDonateErip}</p>

      <button onClick={onClose} className="mt-3 w-full h-12 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-ink cursor-pointer">
        {M.hostDonateLater}
      </button>
      <button
        onClick={() => setThanks(true)}
        className="mt-1 mx-auto block px-3 h-10 text-cap font-semibold text-zine-inkMuted underline underline-offset-2 cursor-pointer"
      >
        {M.hostDonateDone}
      </button>
    </BottomSheet>
  );
};
