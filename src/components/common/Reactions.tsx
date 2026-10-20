import React, { useState } from 'react';
import { Send, Lock, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { telegramService } from '../../services/telegram';

export type ReactionType = 'like' | 'dislike';

/**
 * Кнопки 👋 «Пообщаться» / 🙈 «Скрыть».
 * «Скрыть» убирает человека навсегда, поэтому спрашиваем подтверждение.
 * labeled — крупные кнопки с подписями (для открытой анкеты), иначе компактные значки под фото.
 */
export const ReactionButtons: React.FC<{
  user: UserProfile;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  size?: 'sm' | 'md';
  labeled?: boolean;
}> = ({ user, onReact, size = 'sm', labeled = false }) => {
  const [isConfirmingDislike, setIsConfirmingDislike] = useState(false);
  const [busy, setBusy] = useState<ReactionType | null>(null);

  const btn = size === 'md' ? 'w-[30px] h-[30px] text-[15px]' : 'w-[26px] h-[26px] text-[13px]';

  const react = async (e: React.MouseEvent, type: ReactionType) => {
    e.stopPropagation();
    if (busy) return;
    if (type === 'dislike' && !isConfirmingDislike) {
      telegramService.haptic('warning');
      setIsConfirmingDislike(true);
      return;
    }
    telegramService.haptic(type === 'like' ? 'success' : 'medium');
    setBusy(type);
    try {
      await onReact(user, type);
    } finally {
      setBusy(null);
      setIsConfirmingDislike(false);
    }
  };

  if (isConfirmingDislike && labeled) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-red-50 border border-red-200">
        <span className="text-[10.5px] leading-tight text-red-800">🙈 Скрыть навсегда? Вы больше не увидите друг друга</span>
        <div className="flex gap-1 shrink-0">
          <button onClick={(e) => react(e, 'dislike')} className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer">
            {busy ? <Loader2 size={11} className="animate-spin" /> : 'Да'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsConfirmingDislike(false);
            }}
            className="px-2.5 py-1 rounded-lg bg-white border border-zine-border text-zine-ink text-[11px] cursor-pointer"
          >
            Нет
          </button>
        </div>
      </div>
    );
  }

  if (isConfirmingDislike) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-1 mt-1.5 w-full">
        <span className="text-[9px] leading-tight text-red-700 font-semibold text-center" title="Человек больше не увидит вас, а вы его">Скрыть?</span>
        <div className="flex gap-1">
          <button
            onClick={(e) => react(e, 'dislike')}
            className="px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[9.5px] font-bold cursor-pointer"
          >
            {busy ? <Loader2 size={10} className="animate-spin" /> : 'Да'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsConfirmingDislike(false);
            }}
            className="px-1.5 py-0.5 rounded-md bg-white border border-zine-border text-zine-ink text-[9.5px] font-medium cursor-pointer"
          >
            Нет
          </button>
        </div>
      </div>
    );
  }

  if (labeled) {
    return (
      <div className="flex gap-2">
        <button
          onClick={(e) => react(e, 'like')}
          disabled={user.iLiked}
          className={`flex-1 py-2 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
            user.iLiked
              ? 'bg-zine-sage/15 border-zine-sage/50 text-zine-ink'
              : 'bg-white border-zine-border text-zine-ink hover:border-zine-sage'
          }`}
        >
          {busy === 'like' ? <Loader2 size={13} className="animate-spin" /> : <span className="text-sm">👋</span>}
          <span>{user.iLiked ? 'Привет отправлен' : 'Пообщаться'}</span>
        </button>
        <button
          onClick={(e) => react(e, 'dislike')}
          className="py-2 px-3 rounded-xl border bg-white border-zine-border text-zine-inkMuted hover:border-red-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <span className="text-sm">🙈</span>
          <span>Скрыть</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-1 mt-1.5">
      <button
        onClick={(e) => react(e, 'like')}
        title="Пообщаться"
        className={`${btn} rounded-full border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          user.iLiked
            ? 'bg-zine-sage/20 border-zine-sage ring-1 ring-zine-sage/50'
            : 'bg-white border-zine-border hover:border-zine-sage'
        }`}
      >
        {busy === 'like' ? <Loader2 size={11} className="animate-spin" /> : '👋'}
      </button>
      <button
        onClick={(e) => react(e, 'dislike')}
        title="Скрыть"
        className={`${btn} rounded-full border bg-white border-zine-border hover:border-red-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer`}
      >
        🙈
      </button>
    </div>
  );
};

/**
 * Кнопка «Написать». Доступна, только когда оба нажали 👋 (на связи).
 */
export const ChatButton: React.FC<{ user: UserProfile; className?: string }> = ({ user, className = '' }) => {
  if (user.isMatch && user.username) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          telegramService.haptic('medium');
          telegramService.openChat(user.username);
        }}
        className={`py-2 px-3 rounded-xl bg-zine-terracotta hover:bg-zine-terracottaHover text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer ${className}`}
      >
        <Send size={13} />
        <span className="truncate">Написать @{user.username}</span>
      </button>
    );
  }

  if (user.isMatch) {
    return (
      <div className={`py-2 px-3 rounded-xl bg-zine-sage/15 border border-zine-sage/40 text-zine-ink text-[10.5px] leading-tight text-center ${className}`}>
        🤝 Вы на связи! У человека нет @username — ссылка на него в чате с ботом YesMinsk
      </div>
    );
  }

  return (
    <div className={`py-2 px-3 rounded-xl bg-zine-card border border-dashed border-zine-border text-zine-inkMuted text-[10.5px] leading-tight flex items-center justify-center gap-1.5 ${className}`}>
      <Lock size={12} className="shrink-0" />
      <span>
        {user.iLiked
          ? 'Привет отправлен. Ждём ответа'
          : user.likedMe
          ? 'Хочет пообщаться! Нажми 👋 в ответ, чтобы написать'
          : 'Писать можно, когда оба нажмёте 👋'}
      </span>
    </div>
  );
};

/**
 * Всплывающее окно «Вы на связи!» — оба нажали 👋
 */
export const MatchModal: React.FC<{
  user: UserProfile;
  myAvatarUrl?: string;
  onClose: () => void;
}> = ({ user, myAvatarUrl, onClose }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
    <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
    <div className="relative w-full max-w-[340px] bg-zine-cardElevated rounded-zine border-2 border-zine-terracotta p-5 shadow-zine-float text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="text-3xl mb-1">🤝</div>
      <h2 className="font-serif font-bold text-xl text-zine-ink mb-1">Вы на связи!</h2>
      <p className="text-xs text-zine-inkMuted mb-4">
        Вы и {user.firstName} оба хотите пообщаться. Теперь можно написать в Telegram.
      </p>

      <div className="flex justify-center items-center mb-5">
        {myAvatarUrl && (
          <img src={myAvatarUrl} alt="Ты" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md -rotate-6" />
        )}
        <span className="text-xl -mx-2 z-10">👋</span>
        <img src={user.avatarUrl} alt={user.firstName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md rotate-6" />
      </div>

      <ChatButton user={user} className="w-full mb-2" />
      <button onClick={onClose} className="w-full py-2 text-xs text-zine-inkMuted hover:text-zine-ink cursor-pointer">
        Позже
      </button>
    </div>
  </div>
);
