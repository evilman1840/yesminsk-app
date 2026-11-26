import { useEffect, useRef, useState } from 'react';
import { durationOptions, offerPhrases, shortOffer, upperFirst, wantPhrases } from '../../texts/liveStatus';
import type { ReactNode } from 'react';
import type { LiveStatus } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';

export function currentLiveStatus(status?: LiveStatus | null) {
  return status && Date.parse(status.expiresAt) > Date.now() ? status : null;
}

export function useLiveStatus(status?: LiveStatus | null) {
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!currentLiveStatus(status) || !status) return;
    const timer = window.setTimeout(() => refresh(value => value + 1), Date.parse(status.expiresAt) - Date.now() + 20);
    return () => window.clearTimeout(timer);
  }, [status?.expiresAt]);
  return currentLiveStatus(status);
}

export function LiveStatusText({ status, compact = false }: { status?: LiveStatus | null; compact?: boolean }) {
  const active = useLiveStatus(status);
  if (!active) return null;
  return <span className={compact ? 'grid max-w-full rounded-xl bg-zine-cardElevated px-2.5 py-1.5 text-cap text-zine-ink shadow-zine-sm' : 'block rounded-zine-sm bg-zine-card p-3 text-sm2 text-zine-ink break-words'}>
    {active.want && <span className={compact ? 'truncate font-bold' : 'block'}>{compact ? upperFirst(active.want) : <><b>Хочу</b> {active.want}</>}</span>}
    {active.offer && <span className={compact ? 'truncate text-zine-inkMuted' : 'block'}>{compact ? shortOffer(active.offer) : <><b>Могу</b> {active.offer}</>}</span>}
  </span>;
}

const hourMs = 3600000;
export function LiveStatusEditor({ status, visible = true, onClose, onSave, topAction }: {
  status?: LiveStatus | null;
  visible?: boolean;
  topAction?: ReactNode;
  onClose: () => void;
  onSave: (want: string, offer: string, hours: number) => Promise<void>;
}) {
  const active = useLiveStatus(status);
  const [want, setWant] = useState(active?.want || '');
  const [offer, setOffer] = useState(active?.offer || '');
  const [hours, setHours] = useState(String(active ? Math.min(48, Math.max(1, Math.ceil((Date.parse(active.expiresAt) - Date.now()) / hourMs))) : 3));
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const save = async (duration: number) => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(want, offer, duration);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить статус');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return <BottomSheet title="Я сейчас" onClose={onClose}>
    {topAction}
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save(Number(hours)); }}>
      <p className="text-sm2 text-zine-inkMuted">{visible ? 'Этот статус видно на карте и в анкете. Можно заполнить одну строку или обе.' : 'Сейчас тебя не видно. Статус появится вместе с анкетой, если ты выйдешь из режима невидимки.'}</p>
      {([
        ['Хочу', want, setWant, wantPhrases],
        ['Могу', offer, setOffer, offerPhrases],
      ] as const).map(([label, value, setValue, phrases]) => <div key={label}>
        <label className="block text-sm2 font-semibold">{label}
          <input className="field mt-1" value={value} maxLength={45} onChange={e => setValue(e.target.value)} placeholder={phrases[0]} />
        </label>
        <details className="mt-1 rounded-zine-sm border border-zine-border px-2">
          <summary className="min-h-11 cursor-pointer py-2.5 text-sm2 font-semibold">Заготовки «{label}»</summary>
          <div className="mb-2 flex flex-wrap gap-1.5">{phrases.map(phrase => <button type="button" aria-pressed={phrase === value} key={phrase} onClick={() => setValue(phrase)} className="min-h-11 rounded-zine-sm bg-zine-card px-2 text-cap aria-pressed:bg-zine-sage/25 font-semibold">{phrase}</button>)}</div>
        </details>
      </div>)}
      <label className="block text-sm2 font-semibold">На сколько часов
        <input className="field mt-1" type="number" required min={1} max={48} value={hours} onChange={e => setHours(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-1.5">{durationOptions.map(value => <button type="button" aria-pressed={Number(hours) === value} key={value} onClick={() => setHours(String(value))} className="min-h-11 rounded-zine-sm bg-zine-card px-2.5 text-sm2 font-semibold aria-pressed:bg-zine-sage/25">{value} ч</button>)}</div>
      {active && <p className="text-cap text-zine-inkMuted">Текущий статус до {new Date(active.expiresAt).toLocaleString('ru-RU', { timeZone: 'Europe/Minsk', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} по Минску.</p>}
      {error && <p role="alert" className="text-sm2 text-zine-danger">{error}</p>}
      <button type="submit" disabled={saving || (!want.trim() && !offer.trim())} className="min-h-11 w-full rounded-zine-sm bg-zine-terracotta px-3 font-bold text-white disabled:opacity-50">{saving ? 'Сохраняем…' : 'Сохранить статус'}</button>
      {active && <button type="button" disabled={saving} onClick={() => void save(0)} className="min-h-11 w-full rounded-zine-sm bg-zine-card px-3 text-sm2 font-semibold">Снять статус</button>}
    </form>
  </BottomSheet>;
}
