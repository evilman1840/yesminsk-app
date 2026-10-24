import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { AGE_TEXTS as T } from '../../texts/profile';

/**
 * Возраст остался по умолчанию (25): один раз спрашиваем при входе
 */
export const AgePrompt: React.FC<{ onSave: (age: number) => Promise<void>; onClose: () => void }> = ({ onSave, onClose }) => {
  const [age, setAge] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: number) => {
    if (!value) return setError(T.required);
    if (value < 18) return setError(T.under18);
    setBusy(true);
    setError(null);
    try {
      await onSave(Math.min(99, Math.round(value)));
      telegramService.haptic('success');
      onClose();
    } catch (err: any) {
      setError(err?.message || T.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={T.promptTitle} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{T.promptText}</p>
      <input
        type="number"
        inputMode="numeric"
        min={18}
        max={99}
        value={age}
        onChange={(e) => setAge(e.target.value.slice(0, 2))}
        placeholder={T.placeholder}
        className="field mt-4 text-center text-title"
        autoFocus
      />
      {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
      <button
        onClick={() => save(Number(age))}
        disabled={busy}
        className="mt-4 w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform"
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : T.save}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => save(25)} disabled={busy} className="h-12 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-ink cursor-pointer">
          {T.keep25}
        </button>
        <button onClick={onClose} className="h-12 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-inkMuted cursor-pointer">
          {T.later}
        </button>
      </div>
    </BottomSheet>
  );
};
