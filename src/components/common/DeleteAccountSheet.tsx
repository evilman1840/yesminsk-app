import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { ACCOUNT_TEXTS as T } from '../../texts/account';

/**
 * «Удалить аккаунт?» — что именно удалится, и кнопка «Удалить навсегда»
 */
export const DeleteAccountSheet: React.FC<{ onConfirm: () => Promise<void>; onClose: () => void }> = ({ onConfirm, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <BottomSheet title={T.confirmTitle} onClose={onClose}>
      <p className="text-body text-zine-ink">{T.confirmIntro}</p>
      <ul className="mt-3 space-y-1.5">
        {T.confirmItems.map((item) => (
          <li key={item} className="text-body text-zine-ink">
            • {item}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm2 text-zine-inkMuted">{T.confirmNote}</p>
      {error && <p className="mt-3 text-sm2 font-semibold text-zine-danger">{error}</p>}
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          telegramService.haptic('warning');
          try {
            await onConfirm();
          } catch (err: any) {
            setError(err?.message || T.failed);
            setBusy(false);
          }
        }}
        disabled={busy}
        className="mt-5 w-full h-14 rounded-zine-sm bg-zine-danger text-white text-lead font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform"
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : T.confirmButton}
      </button>
      <button onClick={onClose} disabled={busy} className="mt-2 w-full h-12 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-ink cursor-pointer">
        {T.cancel}
      </button>
    </BottomSheet>
  );
};
