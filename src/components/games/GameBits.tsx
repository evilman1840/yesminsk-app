import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { GamePlayer } from '../../games/types';
import { GAME_TEXTS as T } from '../../texts/games';

/** Общие кусочки экранов игр с людьми: «Крестики-Нолики» и «Морской бой» */

export const formatElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <span className={`w-12 h-7 shrink-0 rounded-full p-0.5 transition-colors ${on ? 'bg-zine-terracotta' : 'bg-zine-border'}`}>
    <span className={`block w-6 h-6 rounded-full bg-white shadow-zine-sm transition-transform ${on ? 'translate-x-5' : ''}`} />
  </span>
);

// Выбор соперника: карточка с отметкой; у бота под ней — уровень
export const PickRow: React.FC<{ icon: React.ReactNode; title: string; hint: string; selected: boolean; onClick: () => void; children?: React.ReactNode }> = ({
  icon,
  title,
  hint,
  selected,
  onClick,
  children
}) => (
  <div className={`rounded-zine bg-zine-cardElevated border-2 transition-colors ${selected ? 'border-zine-terracotta' : 'border-zine-border'}`}>
    <button onClick={onClick} role="radio" aria-checked={selected} className="w-full min-h-[60px] px-3 py-2.5 flex items-center gap-3 text-left cursor-pointer">
      <span className={`w-10 h-10 shrink-0 rounded-zine-sm flex items-center justify-center ${selected ? 'bg-zine-terracotta text-white' : 'bg-zine-terracotta/10 text-zine-terracotta'}`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-body font-bold text-zine-ink">{title}</span>
        <span className="block text-cap text-zine-inkMuted">{hint}</span>
      </span>
      <span className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-zine-terracotta border-zine-terracotta text-white' : 'border-zine-border'}`}>
        {selected && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
    {children}
  </div>
);

export const Avatar: React.FC<{ player?: GamePlayer; size: number }> = ({ player, size }) => {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (player?.avatar && !broken) return <img src={player.avatar} alt="" style={style} onError={() => setBroken(true)} className="rounded-full object-cover bg-zine-card shrink-0" />;
  return (
    <span style={{ ...style, fontSize: size * 0.55 }} className="rounded-full bg-zine-card flex items-center justify-center shrink-0 leading-none">
      {player?.emoji || (player?.name ? player.name[0] : '?')}
    </span>
  );
};

export const SayBar: React.FC<{ label: string; reply: { text: string; key: string } | null; onSay: (key: string, text: string) => void }> = ({ label, reply, onSay }) => (
  <div className="mt-3">
    <p key={reply?.key || 'label'} className={`px-1 text-cap font-semibold ${reply ? 'text-zine-terracotta say-hint-in' : 'text-zine-inkMuted'}`} aria-live="polite">
      {reply ? T.sayReply(reply.text) : label}
    </p>
    <div className="mt-1.5 -mx-3 px-3 overflow-x-auto [scrollbar-width:none]">
      <div className="flex gap-1.5 w-max">
        {T.emojis.map(([key, e], i) => (
          <button
            key={`${key}-${reply?.key || ''}`}
            onClick={() => onSay(key, e)}
            aria-label={`Отправить ${e}`}
            style={{ '--d': `${i * 0.06}s` } as React.CSSProperties}
            className={`w-11 h-11 rounded-full text-[22px] flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
              reply ? 'bg-zine-terracotta/15 say-pulse' : 'bg-zine-card'
            }`}
          >
            {e}
          </button>
        ))}
        {T.phrases.map(([k, text]) => (
          <button key={k} onClick={() => onSay(k, text)} className="h-11 px-3.5 rounded-full bg-zine-card text-sm2 font-semibold text-zine-ink whitespace-nowrap cursor-pointer active:scale-95 transition-transform">
            {text}
          </button>
        ))}
      </div>
    </div>
  </div>
);
