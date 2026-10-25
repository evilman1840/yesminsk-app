import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { SUGGEST_TEXTS as T } from '../../texts/suggest';

/**
 * «Предложи место»: ссылка из Яндекс Карт или название с адресом. Автор проекта проверит и добавит в «Места»
 */
export const SuggestPlaceSheet: React.FC<{ category?: string; context?: string; onDone: (name: string) => void; onClose: () => void }> = ({
  category,
  context,
  onDone,
  onClose
}) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.suggestPlace(text.trim(), category, context);
      telegramService.haptic('success');
      onDone(res.name);
    } catch (err: any) {
      telegramService.haptic('error');
      setError(err?.message || T.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={T.title} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{T.hint}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={3} placeholder={T.placeholder} className="field mt-4" autoFocus />
      <p className="mt-1.5 text-cap text-zine-inkMuted">{T.howTo}</p>
      {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
      <button
        onClick={send}
        disabled={!text.trim() || busy}
        className={`mt-4 w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center cursor-pointer ${
          text.trim() ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-inkMuted cursor-default'
        }`}
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : T.send}
      </button>
    </BottomSheet>
  );
};
