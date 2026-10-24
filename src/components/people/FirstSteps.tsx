import React from 'react';
import { Check, X } from 'lucide-react';
import { telegramService } from '../../services/telegram';

export interface FirstStep {
  id: string;
  title: string;
  done: boolean;
  onClick?: () => void;
}

/**
 * «Первые шаги» для новичков: чек-лист, который пропадает, когда всё сделано (или по крестику)
 */
export const FirstStepsCard: React.FC<{ steps: FirstStep[]; onDismiss: () => void }> = ({ steps, onDismiss }) => {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section className="p-4 rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lead font-bold text-zine-ink">🚀 Первые шаги</p>
          <p className="text-sm2 text-zine-inkMuted">
            Сделано {doneCount} из {steps.length}, так тебя быстрее найдут
          </p>
        </div>
        <button onClick={onDismiss} aria-label="Скрыть" className="w-11 h-11 -mr-2 -mt-2 rounded-full flex items-center justify-center text-zine-inkMuted cursor-pointer">
          <X size={20} />
        </button>
      </div>

      <div className="mt-2 h-2 rounded-full bg-zine-card overflow-hidden">
        <div className="h-full bg-zine-sage transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <div className="mt-3 space-y-1">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => {
              if (step.done || !step.onClick) return;
              telegramService.haptic('selection');
              step.onClick();
            }}
            className={`w-full min-h-[44px] flex items-center gap-3 text-left ${step.done || !step.onClick ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center border-2 ${
                step.done ? 'bg-zine-sage border-zine-sage text-white' : 'border-zine-border'
              }`}
            >
              {step.done && <Check size={16} strokeWidth={3} />}
            </span>
            <span className={`text-body ${step.done ? 'text-zine-inkMuted line-through' : 'text-zine-ink font-semibold'}`}>{step.title}</span>
            {!step.done && step.onClick && <span className="ml-auto text-zine-terracotta text-body font-bold">→</span>}
          </button>
        ))}
      </div>
    </section>
  );
};
