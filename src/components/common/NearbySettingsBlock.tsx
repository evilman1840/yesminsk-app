import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { isTouristArea } from '../../types';
import { NEARBY_TEXTS as T, NEARBY_DEFAULT, NearbySettings } from '../../texts/nearby';

/**
 * Блок анкеты «Сходки рядом»: звать ли через бота, сколько сообщений в день и как далеко.
 * Сохраняется сразу, как остальные переключатели анкеты. focus — открыли по кнопке «Настроить или выключить» из бота
 */
export const NearbySettingsBlock: React.FC<{
  value?: NearbySettings;
  area: string;
  locationManual?: boolean;
  focus?: boolean;
  onChange?: (next: NearbySettings) => void;
}> = ({ value, area, locationManual, focus, onChange }) => {
  const [s, setS] = useState<NearbySettings>(value || NEARBY_DEFAULT);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focus) return;
    const timer = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    return () => clearTimeout(timer);
  }, [focus]);

  const save = async (patch: Partial<NearbySettings>) => {
    const prev = s;
    const next = { ...s, ...patch };
    telegramService.haptic('selection');
    setS(next);
    onChange?.(next);
    try {
      await api.saveNearbySettings({ on: next.on, perDay: next.perDay, radiusKm: next.radiusKm });
    } catch {
      setS(prev);
      onChange?.(prev);
      telegramService.alert(T.failed);
    }
  };

  const where =
    s.radiusKm === 0
      ? T.anywhere
      : locationManual
        ? T.fromPin
        : isTouristArea(area)
          ? T.fromCenter
          : area && area !== 'Минск'
            ? T.fromArea(area)
            : T.noPoint;

  const chips = (options: { value: number; label: string }[], current: number, key: 'perDay' | 'radiusKm') => (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isSelected = current === o.value;
        return (
          <button
            type="button"
            key={o.value}
            aria-pressed={isSelected}
            onClick={() => !isSelected && save({ [key]: o.value })}
            className={`min-h-[44px] px-4 rounded-full border-2 text-body font-semibold transition-colors cursor-pointer ${
              isSelected ? 'border-zine-terracotta bg-zine-terracotta/10 text-zine-ink' : 'border-zine-border bg-zine-cardElevated text-zine-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <section ref={ref} className={`p-4 rounded-zine bg-zine-cardElevated border ${focus ? 'border-zine-terracotta' : 'border-zine-border'}`}>
      <button type="button" role="switch" aria-checked={s.on} aria-label={T.toggle} onClick={() => save({ on: !s.on })} className="w-full flex items-center gap-3 text-left cursor-pointer">
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-zine-ink">{T.title}</span>
          <span className="block text-sm2 text-zine-inkMuted mt-0.5">{T.subtitle}</span>
        </span>
        <span className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${s.on ? 'bg-zine-sage' : 'bg-zine-border'}`}>
          <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${s.on ? 'translate-x-6' : 'translate-x-0'}`} />
        </span>
      </button>

      {s.on ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm2 font-bold text-zine-ink mb-2">{T.perDayLabel}</p>
            {chips(T.perDay, s.perDay, 'perDay')}
          </div>
          <div>
            <p className="text-sm2 font-bold text-zine-ink mb-2">{T.radiusLabel}</p>
            {chips(T.radius, s.radiusKm, 'radiusKm')}
          </div>
          <p className="text-sm2 text-zine-inkMuted">{where}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm2 text-zine-inkMuted">{T.off}</p>
      )}
    </section>
  );
};
