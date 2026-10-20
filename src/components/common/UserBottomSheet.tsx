import React from 'react';
import { ShieldCheck, X, MapPin } from 'lucide-react';
import { UserProfile, GOALS_CONFIG } from '../../types';
import { ReactionButtons, ChatButton, ReactionType } from './Reactions';

interface UserBottomSheetProps {
  user: UserProfile;
  onClose: () => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
}

export const UserBottomSheet: React.FC<UserBottomSheetProps> = ({ user, onClose, onReact }) => {
  const goalConfig = GOALS_CONFIG[user.goal] || GOALS_CONFIG.walk;

  const getGenderLabel = () => {
    if (user.gender === 'male') return 'Парень';
    if (user.gender === 'female') return 'Девушка';
    return null;
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-2 sm:p-4">
      {/* Затемняющий оверлей */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
      />

      {/* Карточка шторки */}
      <div className="w-full max-w-md bg-zine-cardElevated rounded-zine border border-zine-border p-4 shadow-zine-float relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-200 select-none">
        
        {/* Ручка шторки */}
        <div className="w-9 h-1 rounded-full bg-zine-border mx-auto mb-3" />

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-zine-card border border-zine-border flex items-center justify-center text-zine-inkMuted hover:text-zine-ink transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>

        <div className="flex gap-3.5 items-start">
          {/* Аватарка с бейджем цели и реакциями */}
          <div className="relative shrink-0">
            <img
              src={user.avatarUrl}
              alt={user.firstName}
              className="w-16 h-16 rounded-2xl object-cover border border-zine-border shadow-sm"
            />
            <span className="absolute -bottom-1 -right-1 text-xs bg-white rounded-full p-0.5 border border-zine-border shadow-sm">
              {goalConfig.emoji}
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-baseline gap-1.5 truncate">
                <h3 className="font-serif font-bold text-base text-zine-ink leading-tight truncate">
                  {user.firstName}
                </h3>
                {user.age && (
                  <span className="text-xs text-zine-inkMuted font-medium">
                    {user.age} лет
                  </span>
                )}
              </div>

              <span className="text-[10px] font-semibold text-zine-terracotta bg-zine-terracotta/10 px-2 py-0.5 rounded-full shrink-0">
                ~{user.distanceMeters || 350} м
              </span>
            </div>

            {/* Район и пол */}
            <div className="flex items-center gap-2 text-[11px] text-zine-inkMuted mb-2">
              <span className="flex items-center gap-1">
                <MapPin size={11} className="text-zine-terracotta" />
                <span>{user.isTourist ? 'Турист(ка) в Минске' : user.areaName || 'Минск'}</span>
              </span>
              {getGenderLabel() && (
                <span>• {getGenderLabel()}</span>
              )}
            </div>

            {/* Стикер цели */}
            <div className="mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold border ${goalConfig.badgeBg} ${goalConfig.badgeBorder} ${goalConfig.badgeText}`}>
                <span>{goalConfig.emoji}</span>
                <span>{goalConfig.label}</span>
              </span>
            </div>

            {/* Био */}
            <p className="text-xs text-zine-ink/90 leading-relaxed mb-3.5 whitespace-pre-line">
              {user.bio || 'Пока нет описания о себе.'}
            </p>

            <div className="space-y-2">
              {!user.isMatch && <ReactionButtons user={user} onReact={onReact} labeled />}
              <ChatButton user={user} className="w-full" />
            </div>

            {/* Плашка безопасности */}
            <div className="flex items-center justify-center gap-1 text-[9.5px] text-zine-inkMuted mt-2.5 pt-2 border-t border-zine-border/50">
              <ShieldCheck size={12} className="text-zine-sage shrink-0" />
              <span>Координаты смещены на 300м ради приватности</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
