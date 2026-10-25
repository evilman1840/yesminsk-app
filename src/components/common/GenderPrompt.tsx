import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { GENDER_TEXTS as T } from '../../texts/profile';
import { Gender, PreferredGender, AgeRange } from '../../types';

// Ровесники: ±5 лет от своего возраста, но не младше 18
const peersRange = (age: number): AgeRange => ({ min: Math.max(18, age - 5), max: Math.min(99, age + 5) });

const Choice: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={() => {
      telegramService.haptic('selection');
      onClick();
    }}
    className={`h-12 px-3 rounded-zine-sm text-sm2 font-semibold cursor-pointer transition-colors ${active ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-ink'}`}
  >
    {children}
  </button>
);

/**
 * Пол не выбран (стоит «Не скажу» по умолчанию): спрашиваем при входе.
 * Шаг 2 — с кем комфортно гулять (пол и возраст компании), можно пропустить
 */
export const GenderPrompt: React.FC<{
  myAge: number;
  onSave: (gender: Gender) => Promise<void>;
  onSavePrefs: (prefs: { preferredGender: PreferredGender; preferredAgeRange: AgeRange }) => Promise<void>;
  onClose: () => void;
}> = ({ myAge, onSave, onSavePrefs, onClose }) => {
  const [step, setStep] = useState<'gender' | 'prefs'>('gender');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withWhom, setWithWhom] = useState<PreferredGender>('all');
  const [agePeers, setAgePeers] = useState(false);
  const peers = peersRange(myAge || 25);

  const saveGender = async (g: Gender) => {
    setBusy(g);
    setError(null);
    try {
      await onSave(g);
      telegramService.haptic('success');
      setStep('prefs');
    } catch (err: any) {
      setError(err?.message || T.failed);
    } finally {
      setBusy(null);
    }
  };

  const savePrefs = async () => {
    setBusy('prefs');
    setError(null);
    try {
      await onSavePrefs({ preferredGender: withWhom, preferredAgeRange: agePeers ? peers : { min: 18, max: 99 } });
      telegramService.haptic('success');
      onClose();
    } catch (err: any) {
      setError(err?.message || T.failed);
    } finally {
      setBusy(null);
    }
  };

  if (step === 'prefs') {
    return (
      <BottomSheet title={T.prefsStepTitle} onClose={onClose}>
        <p className="text-body text-zine-inkMuted">{T.prefsStepText}</p>
        <p className="mt-4 text-sm2 font-bold text-zine-ink">{T.withWhom}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Choice active={withWhom === 'all'} onClick={() => setWithWhom('all')}>{T.withAll}</Choice>
          <Choice active={withWhom === 'female'} onClick={() => setWithWhom('female')}>{T.withFemale}</Choice>
          <Choice active={withWhom === 'male'} onClick={() => setWithWhom('male')}>{T.withMale}</Choice>
        </div>
        <p className="mt-4 text-sm2 font-bold text-zine-ink">{T.ageTitle}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Choice active={!agePeers} onClick={() => setAgePeers(false)}>{T.ageAny}</Choice>
          <Choice active={agePeers} onClick={() => setAgePeers(true)}>{T.agePeers(peers.min, peers.max)}</Choice>
        </div>
        {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
        <button
          onClick={savePrefs}
          disabled={Boolean(busy)}
          className="mt-5 w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform"
        >
          {busy ? <Loader2 size={22} className="animate-spin" /> : T.done}
        </button>
        <button onClick={onClose} className="mt-2 w-full h-11 text-sm2 font-semibold text-zine-inkMuted cursor-pointer">
          {T.skip}
        </button>
      </BottomSheet>
    );
  }

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
            onClick={() => saveGender(o.id)}
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
