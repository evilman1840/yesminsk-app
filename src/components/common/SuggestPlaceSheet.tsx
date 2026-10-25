import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { SUGGEST_TEXTS as T } from '../../texts/suggest';
import { PLACE_TYPES } from '../../types';

// Сначала то, что чаще предлагают, потом остальное
const POPULAR = ['Кофейня', 'Кафе', 'Антикафе', 'Парк', 'Сквер', 'Спорт', 'Кинотеатр', 'Музей', 'Галерея', 'Театр'];
const TYPES = [...POPULAR.filter((t) => PLACE_TYPES[t]), ...Object.keys(PLACE_TYPES).filter((t) => !POPULAR.includes(t))];

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
  const [type, setType] = useState<string>(category && PLACE_TYPES[category] ? category : '');
  const [allTypes, setAllTypes] = useState(Boolean(type && !POPULAR.includes(type)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim() || busy) return;
    if (!type) return setError(T.typeNeeded);
    setBusy(true);
    setError(null);
    try {
      const res = await api.suggestPlace(text.trim(), type, context);
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
      <p className="mt-4 text-body font-bold text-zine-ink">{T.typeTitle}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(allTypes ? TYPES : TYPES.filter((t) => POPULAR.includes(t))).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setError(null);
              telegramService.haptic('selection');
            }}
            className={`h-10 px-3 rounded-full text-sm2 font-semibold cursor-pointer active:scale-95 transition-transform ${
              type === t ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-ink'
            }`}
          >
            {PLACE_TYPES[t]} {t}
          </button>
        ))}
        {!allTypes && (
          <button type="button" onClick={() => setAllTypes(true)} className="h-10 px-3 rounded-full text-sm2 font-semibold text-zine-terracotta bg-zine-card cursor-pointer">
            {T.typeMore}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
      <button
        onClick={send}
        disabled={!text.trim() || busy}
        className={`mt-4 w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center cursor-pointer ${
          text.trim() && type ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-inkMuted cursor-default'
        }`}
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : T.send}
      </button>
    </BottomSheet>
  );
};
