import React, { useEffect, useState } from 'react';
import { api, Fund } from '../../services/api';

export const rub = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} р.`;

// Цифры донатов с сервера (null — пока не загрузились или ошибка)
export const useFund = (enabled = true) => {
  const [fund, setFund] = useState<Fund | null>(null);
  useEffect(() => {
    if (!enabled) return;
    api
      .getFund()
      .then(setFund)
      .catch(() => {});
  }, [enabled]);
  return fund;
};

/**
 * Сколько собрано донатов: шкала из двух частей — приютам, волонтёрам и кофе, и развитие.
 * Цифры автор пишет боту командой /fund. Пока ничего не собрано — не показываем.
 * Без fund загружает цифры сам (в «Новостях»), окно доната передаёт уже загруженные
 */
export const FundBar: React.FC<{ className?: string; fund?: Fund | null }> = ({ className = '', fund: given }) => {
  const loaded = useFund(given === undefined);
  const fund = given === undefined ? loaded : given;
  if (!fund || fund.total <= 0) return null;
  const dev = Math.max(0, fund.total - fund.community);
  const share = Math.round((fund.community / fund.total) * 100);

  return (
    <div className={`p-4 rounded-zine bg-zine-card ${className}`}>
      <p className="text-body text-zine-ink">
        💛 Собрано <b>{rub(fund.total)}</b>
      </p>
      <div className="mt-2 flex h-3 rounded-full overflow-hidden bg-zine-border" aria-hidden>
        <span className="bg-zine-terracotta" style={{ width: `${share}%` }} />
        <span className="bg-zine-sage" style={{ width: `${100 - share}%` }} />
      </div>
      <div className="mt-2 flex justify-between gap-3">
        <span>
          <span className="block text-body font-bold text-zine-terracotta whitespace-nowrap">{share}% · {rub(fund.community)}</span>
          <span className="block text-cap text-zine-inkMuted">приютам, волонтёрам и кофе 🐾</span>
        </span>
        <span className="text-right">
          <span className="block text-body font-bold text-zine-sage whitespace-nowrap">{100 - share}% · {rub(dev)}</span>
          <span className="block text-cap text-zine-inkMuted">серверы и развитие</span>
        </span>
      </div>
    </div>
  );
};
