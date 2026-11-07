import React, { useState } from 'react';
import { thumb } from '../../utils/thumb';
import { Send, Lock, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { telegramService } from '../../services/telegram';
import { useBackButton } from '../../hooks/useTelegram';
import { useWavesLeft, openMeetups } from '../../utils/waves';
import { WAVE_TEXTS } from '../../texts/waves';

export type ReactionType = 'like' | 'dislike';

/**
 * Дневной лимит 👋. Ответ на чужой 👋 в лимит не входит, поэтому тем, кто «Хочет пообщаться», кнопку не прячем.
 * Возвращает: 'out' — 👋 закончились, число — осталось 3 и меньше, null — ничего не показываем
 */
export function useWaveState(user: UserProfile): 'out' | number | null {
  const left = useWavesLeft();
  if (left === null || user.iLiked || user.isMatch || user.likedMe) return null;
  if (left <= 0) return 'out';
  return left <= 3 ? left : null;
}

// «Осталось 3 👋 на сегодня» — мелко под кнопкой
export const WavesLeftNote: React.FC<{ left: number }> = ({ left }) => (
  <p className="mt-1.5 text-center text-cap text-zine-inkMuted">{WAVE_TEXTS.left(left)}</p>
);

// 👋 на сегодня закончились — вместо кнопки «Пообщаться» ведём в сходки. hideButton — «🙈 Скрыть» остаётся рядом
export const WavesOutCard: React.FC<{ hideButton?: React.ReactNode; rounded?: string }> = ({ hideButton, rounded = 'rounded-zine-sm' }) => (
  <div onClick={(e) => e.stopPropagation()} className="p-3 rounded-zine-sm bg-zine-card">
    <p className="text-body font-bold text-zine-ink mb-1">{WAVE_TEXTS.outTitle}</p>
    <p className="text-sm2 text-zine-inkMuted mb-2.5">{WAVE_TEXTS.outText}</p>
    <div className="flex gap-2">
      {hideButton}
      <button
        onClick={() => {
          telegramService.haptic('medium');
          openMeetups();
        }}
        className={`flex-[1.6] h-12 px-3 whitespace-nowrap ${rounded} bg-zine-terracotta text-white text-body font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform`}
      >
        {WAVE_TEXTS.openMeetups}
      </button>
    </div>
  </div>
);

/**
 * Кнопки 👋 «Пообщаться» / 🙈 «Скрыть».
 * «Скрыть» убирает человека навсегда, поэтому спрашиваем подтверждение.
 */
export const ReactionButtons: React.FC<{
  user: UserProfile;
  onReact: (user: UserProfile, type: ReactionType) => Promise<unknown> | void;
}> = ({ user, onReact }) => {
  const [isConfirmingDislike, setIsConfirmingDislike] = useState(false);
  const [busy, setBusy] = useState<ReactionType | null>(null);
  const waves = useWaveState(user);

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
      <div onClick={(e) => e.stopPropagation()} className="p-3 rounded-zine-sm bg-zine-danger/10 border border-zine-danger/25">
        <p className="text-sm2 text-zine-ink mb-2.5">
          🙈 Скрыть навсегда? Вы больше не увидите друг друга.
        </p>
        <div className="flex gap-2">
          <button
            onClick={(e) => react(e, 'dislike')}
            className="flex-1 h-12 rounded-zine-sm bg-zine-danger text-white text-body font-bold flex items-center justify-center cursor-pointer active:scale-[0.98] transition-transform"
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : 'Да, скрыть'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsConfirmingDislike(false);
            }}
            className="flex-1 h-12 rounded-zine-sm bg-zine-cardElevated border border-zine-border text-zine-ink text-body font-semibold cursor-pointer active:scale-[0.98] transition-transform"
          >
            Нет
          </button>
        </div>
      </div>
    );
  }

  const hideButton = (
    <button
      onClick={(e) => react(e, 'dislike')}
      className={`h-12 px-4 rounded-zine-sm ${waves === 'out' ? 'bg-zine-cardElevated' : 'bg-zine-card'} text-zine-inkMuted text-body font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer`}
    >
      <span className="text-[20px] leading-none">🙈</span>
      <span>Скрыть</span>
    </button>
  );

  if (waves === 'out') return <WavesOutCard hideButton={hideButton} />;

  return (
    <div>
    <div className="flex gap-2">
      {hideButton}
      <button
        onClick={(e) => react(e, 'like')}
        disabled={user.iLiked}
        className={`flex-1 h-12 px-4 rounded-zine-sm text-body font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
          user.iLiked
            ? 'bg-zine-sage/15 text-zine-sage'
            : 'bg-zine-terracotta text-white shadow-zine-sm active:bg-zine-terracottaHover'
        }`}
      >
        {busy === 'like' ? <Loader2 size={20} className="animate-spin" /> : <span className="text-[20px] leading-none">👋</span>}
        <span>{user.iLiked ? 'Привет отправлен' : 'Пообщаться'}</span>
      </button>
    </div>
    {typeof waves === 'number' && <WavesLeftNote left={waves} />}
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
        className={`h-12 px-4 rounded-zine-sm bg-zine-terracotta active:bg-zine-terracottaHover text-white text-body font-bold flex items-center justify-center gap-2 shadow-zine-sm active:scale-[0.98] transition-all cursor-pointer ${className}`}
      >
        <Send size={20} />
        <span className="truncate">Написать в Telegram</span>
      </button>
    );
  }

  if (user.isMatch) {
    return (
      <div className={`p-3 rounded-zine-sm bg-zine-sage/15 text-zine-ink text-sm2 text-center ${className}`}>
        🤝 Вы на связи! У человека нет @username, ссылку на него прислал бот в чате.
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-zine-sm bg-zine-card text-zine-inkMuted text-sm2 flex items-center justify-center gap-2 text-center ${className}`}>
      <Lock size={18} className="shrink-0" />
      <span>
        {user.iLiked
          ? 'Привет отправлен. Ждём ответа'
          : user.likedMe
          ? 'Хочет пообщаться! Нажми 👋 в ответ'
          : 'Написать можно, когда оба нажмёте 👋'}
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
}> = ({ user, myAvatarUrl, onClose }) => {
  useBackButton(onClose);
  return (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
    <div onClick={onClose} className="absolute inset-0 bg-black/55" />
    <div className="relative w-full max-w-[360px] bg-zine-cardElevated rounded-zine-lg p-6 shadow-zine-float text-center">
      <div className="flex justify-center items-center mb-5 mt-1">
        {myAvatarUrl && (
          <img src={myAvatarUrl} alt="Ты" className="w-24 h-24 rounded-zine object-cover border-4 border-zine-cardElevated shadow-zine -rotate-6" />
        )}
        <span className="text-[32px] -mx-3 z-10">🤝</span>
        <img src={thumb(user.avatarUrl)} alt={user.firstName} className="w-24 h-24 rounded-zine object-cover border-4 border-zine-cardElevated shadow-zine rotate-6" />
      </div>
      <h2 className="font-serif font-bold text-display text-zine-ink mb-2">Вы на связи!</h2>
      <p className="text-body text-zine-inkMuted mb-6">
        Вы и {user.firstName} оба хотите пообщаться. Теперь можно написать в Telegram.
      </p>

      <ChatButton user={user} className="w-full mb-2" />
      <button onClick={onClose} className="w-full h-12 text-body font-semibold text-zine-inkMuted cursor-pointer">
        Позже
      </button>
    </div>
  </div>
  );
};
