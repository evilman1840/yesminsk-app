import React from 'react';
import { USERNAME_TEXTS as T } from '../../texts/profile';

/**
 * Нет @username: подсказываем завести (иначе на связи написать не смогут)
 */
export const UsernameBanner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 rounded-zine bg-zine-mustard/15 ${className}`}>
    <p className="text-body font-bold text-zine-ink">{T.title}</p>
    <p className="mt-1 text-sm2 text-zine-ink">{T.text}</p>
    <p className="mt-2 text-sm2 text-zine-inkMuted">{T.how}</p>
  </div>
);
