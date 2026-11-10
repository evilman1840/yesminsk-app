import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { telegramService } from '../services/telegram';
import { EPISODES, SerialEpisode } from './episodes';
import { isReleased, SerialState } from './useSerial';

/**
 * Вопрос в конце серии, чтобы не просто смотрели.
 * «Угадай, что дальше» — ответ и проценты, разгадка на обложке следующей серии (SerialReveal).
 * «А ты?» — ответ и проценты, а у варианта с желанием — кнопка «🙋 Отметить: хочу…» (желание только по нажатию)
 */

const pctOf = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export const SerialQuestionCard: React.FC<{ ep: SerialEpisode; serial: SerialState }> = ({ ep, serial }) => {
  const q = ep.question!;
  const mine = serial.seen[ep.n]?.answer;
  const wished = !!serial.seen[ep.n]?.wished;
  const counts = serial.answers[ep.n] || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const [wishState, setWishState] = useState<{ busy?: boolean; done?: string; error?: string }>({});
  const picked = q.options.find((o) => o.id === mine);

  const pick = (id: string) => {
    if (mine) return;
    telegramService.haptic('selection');
    serial.answer(ep.n, id);
  };

  const addWish = async () => {
    const w = picked?.wish;
    if (!w || wishState.busy) return;
    telegramService.haptic('medium');
    setWishState({ busy: true });
    try {
      const r = await api.createWish({ kind: w.kind, timeWindow: w.timeWindow });
      serial.markWished(ep.n);
      telegramService.haptic('success');
      setWishState({
        done: r.sameCount > 0 ? `Ещё ${r.sameCount} хотят того же. Бот напишет, когда соберётся компания` : 'Как только кто-то захочет того же, бот напишет'
      });
    } catch (e: any) {
      telegramService.haptic('warning');
      // Сервер отвечает по-русски (например, «уже 5 желаний»); сбой сети — английский текст браузера, его не показываем
      const msg = String(e?.message || '');
      setWishState({ error: /[а-яё]/i.test(msg) ? msg : 'Не получилось отметить, попробуй ещё раз' });
    }
  };

  return (
    <div className="relative z-10 w-full rounded-[18px] bg-white border-2 border-[#2B2623] shadow-[3px_3px_0_#2B2623] px-4 py-3.5 text-left">
      <p className="text-cap font-bold uppercase tracking-wide text-[#D95C3C]">{q.kind === 'guess' ? 'Угадай' : 'А ты?'}</p>
      <p className="mt-0.5 font-hand font-bold text-[28px] leading-[1.05]">{q.text}</p>
      <div className="mt-3 flex flex-col gap-2">
        {q.options.map((o) => {
          const n = counts[o.id] || 0;
          const p = pctOf(n, total);
          const me = mine === o.id;
          return mine ? (
            <div key={o.id} className={`relative h-11 rounded-full overflow-hidden border-2 ${me ? 'border-[#D95C3C]' : 'border-[#2B2623]/15'}`}>
              <span className={`absolute inset-y-0 left-0 ${me ? 'bg-[#D95C3C]/20' : 'bg-[#2B2623]/[0.06]'}`} style={{ width: `${p}%` }} />
              <span className="relative h-full px-4 flex items-center justify-between gap-2 text-sm2">
                <span className={`truncate ${me ? 'font-bold' : ''}`}>
                  {o.label}
                  {me && <Check size={16} strokeWidth={3} className="inline ml-1 -mt-0.5 text-[#D95C3C]" />}
                </span>
                <span className="shrink-0 font-bold">{p}%</span>
              </span>
            </div>
          ) : (
            <button
              key={o.id}
              onClick={() => pick(o.id)}
              className="h-11 px-4 rounded-full border-2 border-[#2B2623] bg-[#FAF7F2] text-left text-sm2 font-semibold cursor-pointer active:translate-y-0.5"
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {mine && q.kind === 'guess' && <p className="mt-2.5 text-sm2 text-[#6B635C]">Ответ узнаешь в следующей серии 🤫</p>}

      {mine && q.kind === 'you' && picked?.wish && (
        <div className="mt-3">
          {wished || wishState.done ? (
            <p className="text-sm2 text-[#2B2623]">
              ✅ <b>Отмечено в «Хочу сходить».</b> {wishState.done || 'Бот напишет, когда найдутся люди'}
            </p>
          ) : (
            <>
              <button
                onClick={addWish}
                disabled={wishState.busy}
                className="w-full h-12 rounded-full bg-[#D95C3C] text-white font-bold border-2 border-[#2B2623] shadow-[3px_3px_0_#2B2623] flex items-center justify-center gap-2 cursor-pointer active:translate-y-0.5"
              >
                {wishState.busy ? <Loader2 size={20} className="animate-spin" /> : `🙋 Отметить: хочу ${picked.wish.what}`}
              </button>
              <p className={`mt-1.5 text-cap ${wishState.error ? 'text-[#B3412A]' : 'text-[#6B635C]'}`}>
                {wishState.error || 'Когда кто-то захочет того же на этой неделе, бот предложит собраться компанией'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** Обложка следующей серии: разгадка вчерашнего «Угадай» и угадал ли я */
export const SerialReveal: React.FC<{ ep: SerialEpisode; serial: SerialState }> = ({ ep, serial }) => {
  const prev = EPISODES.find((e) => e.n === ep.n - 1);
  const q = prev?.question;
  if (!prev || !q || q.kind !== 'guess' || !q.answer || !q.reveal || !isReleased(prev)) return null;
  const mine = serial.seen[prev.n]?.answer;
  const counts = serial.answers[prev.n] || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const right = pctOf(counts[q.answer] || 0, total);
  return (
    <div className="pointer-events-none absolute z-20 inset-x-4 bottom-6 rounded-[16px] bg-[#FFFDF9]/95 border-2 border-[#2B2623] shadow-[3px_3px_0_#2B2623] px-4 py-3 text-[#2B2623]">
      <p className="text-cap text-[#6B635C]">В прошлой серии: «{q.text}»</p>
      <p className="mt-0.5 text-body font-bold">{q.reveal}</p>
      <p className="mt-1 text-sm2">
        {mine ? (mine === q.answer ? '🎉 Ты угадал(а)! ' : '😅 В этот раз мимо. ') : ''}
        {total > 0 && `Угадали ${right}% зрителей`}
      </p>
    </div>
  );
};
