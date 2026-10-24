import React, { useState } from 'react';
import { Minus, Plus, Loader2 } from 'lucide-react';
import { AppEvent, JoinOptions, maxGuestsFor, SUPPORT_RULES } from '../../types';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';
import { useMainButton } from '../../hooks/useTelegram';

/**
 * «Пойду!» — с кем идёшь: сколько человек ведёшь с собой и есть ли дети.
 * Взять можно сколько угодно, лишь бы хватило мест у организатора.
 * Если уже записан(а) — можно поменять или отказаться
 */
export const JoinSheet: React.FC<{
  event: AppEvent;
  onConfirm: (options: JoinOptions) => Promise<unknown>;
  onLeave: () => Promise<unknown>;
  onClose: () => void;
}> = ({ event, onConfirm, onLeave, onClose }) => {
  const maxGuests = maxGuestsFor(event);
  const [guests, setGuests] = useState(Math.min(event.myGuests || 0, maxGuests));
  const [withKids, setWithKids] = useState(Boolean(event.myWithKids));
  const [busy, setBusy] = useState<'join' | 'leave' | null>(null);
  // «Поныть»: перед записью — согласие с правилами встречи
  const needsRules = event.category === 'support' && !event.isJoined;
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const total = 1 + guests;

  const run = async (kind: 'join' | 'leave') => {
    if (busy) return;
    setBusy(kind);
    try {
      await (kind === 'join' ? onConfirm({ guests, withKids }) : onLeave());
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const joinText = event.isJoined ? 'Сохранить' : guests > 0 ? `Пойдём! Нас ${total}` : 'Пойду!';
  const hasNativeJoin = useMainButton({
    text: joinText,
    onClick: () => run('join'),
    enabled: !(needsRules && !rulesAccepted) && busy !== 'leave',
    loading: busy === 'join'
  });

  const step = (delta: number) => {
    const next = Math.min(Math.max(0, guests + delta), maxGuests);
    if (next === guests) {
      telegramService.haptic('warning');
      return;
    }
    telegramService.haptic('selection');
    setGuests(next);
  };

  return (
    <BottomSheet title={event.isJoined ? 'Ты идёшь. Что поменять?' : 'Сколько вас?'} onClose={onClose}>
      <div className="space-y-4">
        {/* Сколько человек: я + гости */}
        <div className="p-4 rounded-zine bg-zine-card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lead font-bold text-zine-ink">{guests === 0 ? 'Только я' : `Нас ${total}`}</p>
            <p className="text-sm2 text-zine-inkMuted">
              {guests === 0 ? 'Нажми +, если берёшь кого-то с собой' : `Я и ещё ${guests}`}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={guests === 0}
              aria-label="Меньше"
              className="w-11 h-11 rounded-full bg-zine-cardElevated border border-zine-border text-zine-ink flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95"
            >
              <Minus size={20} />
            </button>
            <span className="w-9 text-center text-title font-bold text-zine-ink">+{guests}</span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={guests >= maxGuests}
              aria-label="Больше"
              className="w-11 h-11 rounded-full bg-zine-terracotta text-white flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {Number.isFinite(maxGuests) && (
          <p className="-mt-2 px-1 text-cap text-zine-inkMuted">
            {maxGuests === 0 ? 'Свободное место осталось только для тебя' : `Можно взять ещё до ${maxGuests}: столько мест свободно`}
          </p>
        )}

        {/* С детьми */}
        <button
          type="button"
          onClick={() => {
            telegramService.haptic('selection');
            setWithKids((v) => !v);
          }}
          className={`w-full p-4 rounded-zine border-2 flex items-center gap-3 text-left transition-colors cursor-pointer ${
            withKids ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
          }`}
        >
          <span className="text-[28px] leading-none">👶</span>
          <span className="flex-1 min-w-0">
            <span className="block text-body font-bold text-zine-ink">Идём с детьми</span>
            <span className="block text-sm2 text-zine-inkMuted">Организатор будет знать заранее</span>
          </span>
          <span
            className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center text-white text-sm2 font-bold ${
              withKids ? 'bg-zine-terracotta border-zine-terracotta' : 'border-zine-border'
            }`}
          >
            {withKids ? '✓' : ''}
          </span>
        </button>

        {needsRules && (
          <button
            type="button"
            onClick={() => {
              telegramService.haptic('selection');
              setRulesAccepted((v) => !v);
            }}
            className={`w-full p-4 rounded-zine border-2 text-left transition-colors cursor-pointer ${
              rulesAccepted ? 'border-zine-terracotta bg-zine-terracotta/10' : 'border-zine-border bg-zine-cardElevated'
            }`}
          >
            <span className="flex items-start gap-3">
              <span
                className={`mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center text-white text-sm2 font-bold ${
                  rulesAccepted ? 'bg-zine-terracotta border-zine-terracotta' : 'border-zine-border'
                }`}
              >
                {rulesAccepted ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span className="block text-body font-bold text-zine-ink">🫂 Принимаю правила встречи</span>
                {SUPPORT_RULES.map((r) => (
                  <span key={r} className="block text-sm2 text-zine-inkMuted">
                    • {r}
                  </span>
                ))}
              </span>
            </span>
          </button>
        )}

        {!hasNativeJoin && (
          <button
            type="button"
            disabled={needsRules && !rulesAccepted}
            onClick={() => run('join')}
            className="w-full h-14 rounded-zine-sm bg-zine-terracotta active:bg-zine-terracottaHover text-white text-lead font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-default"
          >
            {busy === 'join' ? <Loader2 size={22} className="animate-spin" /> : joinText}
          </button>
        )}
        {event.isJoined && (
          <button
            type="button"
            onClick={() => run('leave')}
            className="w-full h-12 rounded-zine-sm text-body font-semibold text-zine-danger flex items-center justify-center cursor-pointer"
          >
            {busy === 'leave' ? <Loader2 size={20} className="animate-spin" /> : 'Не пойду'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
};
