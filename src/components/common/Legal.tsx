import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { TERMS, PRIVACY, LEGAL_UI as T, LegalDoc } from '../../texts/legal';

export type LegalKind = 'terms' | 'privacy';
const DOCS: Record<LegalKind, LegalDoc> = { terms: TERMS, privacy: PRIVACY };

/**
 * Текст документа в шторке
 */
export const LegalSheet: React.FC<{ kind: LegalKind; onClose: () => void }> = ({ kind, onClose }) => {
  const doc = DOCS[kind];
  return (
    <BottomSheet title={doc.title} onClose={onClose}>
      <p className="text-sm2 text-zine-inkMuted">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.title} className="mt-5">
          <h3 className="text-body font-bold text-zine-ink">{s.title}</h3>
          {s.text.map((t, i) => (
            <p key={i} className="mt-1.5 text-sm2 text-zine-ink">
              {t}
            </p>
          ))}
        </section>
      ))}
      <button onClick={onClose} className="mt-6 w-full h-12 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-ink cursor-pointer">
        {T.close}
      </button>
    </BottomSheet>
  );
};

/**
 * Галочка «Мне есть 18 лет, я принимаю Соглашение и даю согласие…» со ссылками на документы
 */
export const ConsentCheckbox: React.FC<{ checked: boolean; onChange: (v: boolean) => void; onOpen: (kind: LegalKind) => void; highlight?: boolean }> = ({
  checked,
  onChange,
  onOpen,
  highlight
}) => (
  <label className={`flex gap-3 items-start p-3 rounded-zine-sm cursor-pointer bg-zine-card ${highlight && !checked ? 'ring-2 ring-zine-danger' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        onChange(e.target.checked);
        telegramService.haptic('selection');
      }}
      className="mt-0.5 w-5 h-5 shrink-0 accent-zine-terracotta cursor-pointer"
    />
    <span className="text-sm2 text-zine-ink">
      {T.consent}{' '}
      <button type="button" onClick={(e) => (e.preventDefault(), onOpen('terms'))} className="font-semibold text-zine-terracotta underline underline-offset-2 cursor-pointer">
        {T.terms}
      </button>{' '}
      {T.and}{' '}
      <button type="button" onClick={(e) => (e.preventDefault(), onOpen('privacy'))} className="font-semibold text-zine-terracotta underline underline-offset-2 cursor-pointer">
        {T.privacy}
      </button>
    </span>
  </label>
);

/**
 * Для тех, кто зарегистрировался до документов: принять новую редакцию. Закрыть без принятия нельзя
 */
export const LegalUpdateOverlay: React.FC<{ onAccept: () => Promise<void> }> = ({ onAccept }) => {
  const [checked, setChecked] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<LegalKind | null>(null);

  const accept = async () => {
    if (!checked) {
      setHighlight(true);
      telegramService.haptic('error');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAccept();
      telegramService.haptic('success');
    } catch {
      setError(T.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center">
      <div className="w-full max-w-md bg-zine-paper rounded-t-zine px-5 pt-6 pb-8">
        <h2 className="font-serif font-bold text-title text-zine-ink">{T.updatedTitle}</h2>
        <p className="mt-2 text-body text-zine-inkMuted">{T.updatedText}</p>
        <div className="mt-4">
          <ConsentCheckbox checked={checked} onChange={setChecked} onOpen={setDoc} highlight={highlight} />
        </div>
        {highlight && !checked && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{T.needConsent}</p>}
        {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
        <button
          onClick={accept}
          disabled={busy}
          className={`mt-4 w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center cursor-pointer ${
            checked ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-inkMuted'
          }`}
        >
          {busy ? <Loader2 size={22} className="animate-spin" /> : T.accept}
        </button>
      </div>
      {doc && <LegalSheet kind={doc} onClose={() => setDoc(null)} />}
    </div>
  );
};
