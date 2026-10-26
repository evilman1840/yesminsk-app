import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const rub = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} р.`;

/**
 * Сколько собрано донатов: шкала из двух частей — котёл для пользователей и развитие.
 * Цифры автор пишет боту командой /fund. Пока ничего не собрано — не показываем
 */
export const FundBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [fund, setFund] = useState<{ total: number; community: number } | null>(null);
  useEffect(() => {
    api
      .getFund()
      .then(setFund)
      .catch(() => {});
  }, []);
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
          <span className="block text-body font-bold text-zine-terracotta whitespace-nowrap">☕ {rub(fund.community)}</span>
          <span className="block text-cap text-zine-inkMuted">подарки для вас</span>
        </span>
        <span className="text-right">
          <span className="block text-body font-bold text-zine-sage whitespace-nowrap">🌱 {rub(dev)}</span>
          <span className="block text-cap text-zine-inkMuted">на развитие</span>
        </span>
      </div>
    </div>
  );
};
