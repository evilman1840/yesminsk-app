import React, { useState } from 'react';
import { Send, Lock, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { telegramService } from '../../services/telegram';

export type ReactionType = 'like' | 'dislike';

/**
 * Кнопки 👍 / 👎 под фото анкеты.
 * Дизлайк скрывает человека навсегда, поэтому спрашиваем подтверждение.
 */
export const ReactionButtons: React.FC<{
  user: UserProfile;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  size?: 'sm' | 'md';
}> = ({ user, onReact, size = 'sm' }) => {
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

  return (
    <div className="flex justify-center gap-1 mt-1.5">
      <button
        onClick={(e) => react(e, 'like')}
        title="Нравится"
        className={`${btn} rounded-full border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          user.iLiked
            ? 'bg-zine-sage/20 border-zine-sage ring-1 ring-zine-sage/50'
            : 'bg-white border-zine-border hover:border-zine-sage'
        }`}
      >
        {busy === 'like' ? <Loader2 size={11} className="animate-spin" /> : '👍'}
      </button>
      <button
        onClick={(e) => react(e, 'dislike')}
        title="Не нравится — скрыть"
        className={`${btn} rounded-full border bg-white border-zine-border hover:border-red-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer`}
      >
        👎
      </button>
    </div>
  );
};

/**
 * Кнопка «Написать». Доступна только после взаимного лайка (мэтча).
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
        🎉 Мэтч! У человека нет @username — ссылка на него в чате с ботом YesMinsk
      </div>
    );
  }

  return (
    <div className={`py-2 px-3 rounded-xl bg-zine-card border border-dashed border-zine-border text-zine-inkMuted text-[10.5px] leading-tight flex items-center justify-center gap-1.5 ${className}`}>
      <Lock size={12} className="shrink-0" />
      <span>
        {user.iLiked
          ? 'Лайк отправлен. Ждём ответной симпатии'
          : user.likedMe
          ? 'Вы понравились! Лайкни в ответ, чтобы написать'
          : 'Писать можно после взаимного 👍'}
      </span>
    </div>
  );
};

/**
 * Всплывающее окно «Это мэтч!»
 */
export const MatchModal: React.FC<{
  user: UserProfile;
  myAvatarUrl?: string;
  onClose: () => void;
}> = ({ user, myAvatarUrl, onClose }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
    <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
    <div className="relative w-full max-w-[340px] bg-zine-cardElevated rounded-zine border-2 border-zine-terracotta p-5 shadow-zine-float text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="text-3xl mb-1">🎉</div>
      <h2 className="font-serif font-bold text-xl text-zine-ink mb-1">Это мэтч!</h2>
      <p className="text-xs text-zine-inkMuted mb-4">
        Вы и {user.firstName} понравились друг другу. Теперь можно написать в Telegram.
      </p>

      <div className="flex justify-center items-center mb-5">
        {myAvatarUrl && (
          <img src={myAvatarUrl} alt="Ты" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md -rotate-6" />
        )}
        <span className="text-xl -mx-2 z-10">❤️</span>
        <img src={user.avatarUrl} alt={user.firstName} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md rotate-6" />
      </div>

      <ChatButton user={user} className="w-full mb-2" />
      <button onClick={onClose} className="w-full py-2 text-xs text-zine-inkMuted hover:text-zine-ink cursor-pointer">
        Позже
      </button>
    </div>
  </div>
);
