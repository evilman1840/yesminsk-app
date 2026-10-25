import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { GENDER_TEXTS as T } from '../../texts/profile';
import { Gender } from '../../types';

/**
 * Пол не выбран (стоит «Не скажу» по умолчанию): один раз спрашиваем при входе
 */
export const GenderPrompt: React.FC<{ onSave: (gender: Gender) => Promise<void>; onClose: () => void }> = ({ onSave, onClose }) => {
  const [busy, setBusy] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (g: Gender) => {
    setBusy(g);
    setError(null);
    try {
      await onSave(g);
      telegramService.haptic('success');
      onClose();
    } catch (err: any) {
      setError(err?.message || T.failed);
    } finally {
      setBusy(null);
    }
  };

  const options: { id: Gender; label: string }[] = [
    { id: 'female', label: T.female },
    { id: 'male', label: T.male },
    { id: 'not_specified', label: T.unset }
  ];

  return (
    <BottomSheet title={T.promptTitle} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{T.promptText}</p>
      <div className="mt-4 space-y-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => save(o.id)}
            disabled={Boolean(busy)}
            className={`w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform ${
              o.id === 'not_specified' ? 'bg-zine-card text-zine-ink' : 'bg-zine-terracotta text-white'
            }`}
          >
            {busy === o.id ? <Loader2 size={22} className="animate-spin" /> : o.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
      <button onClick={onClose} className="mt-2 w-full h-11 text-sm2 font-semibold text-zine-inkMuted cursor-pointer">
        {T.later}
      </button>
    </BottomSheet>
  );
};
