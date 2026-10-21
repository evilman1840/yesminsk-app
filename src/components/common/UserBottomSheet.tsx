import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { UserProfile, goalsOf, isAvailableNow, formatTime } from '../../types';
import { ReactionButtons, ChatButton, ReactionType } from './Reactions';
import { BottomSheet } from '../ui/BottomSheet';
import { ReportSheet, SafetyTipsSheet } from './ReportSheet';

interface UserBottomSheetProps {
  user: UserProfile;
  onClose: () => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  onReported: (user: UserProfile) => void;
}

export const formatDistance = (meters?: number) => {
  if (!meters) return null;
  return meters < 1000 ? `${Math.round(meters / 50) * 50 || 50} м` : `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
};

/**
 * Анкета человека во всплывающей шторке (с карты и из ленты)
 */
export const UserBottomSheet: React.FC<UserBottomSheetProps> = ({ user, onClose, onReact, onReported }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);

  const goals = goalsOf(user);
  const distance = formatDistance(user.distanceMeters);

  return (
    <BottomSheet onClose={onClose} title={user.age ? `${user.firstName}, ${user.age}` : user.firstName}>
      <img
        src={user.avatarUrl}
        alt={user.firstName}
        className="w-full aspect-[4/3] rounded-zine object-cover bg-zine-card"
      />

      {isAvailableNow(user) && (
        <p className="mt-4 p-3 rounded-zine-sm bg-[#2FA36B]/15 text-body font-semibold text-zine-ink">
          ⚡ Могу сейчас · до {formatTime(user.availableUntil)}
        </p>
      )}

      <div className="flex items-center gap-2 mt-4 text-body text-zine-inkMuted">
        <MapPin size={20} className="text-zine-terracotta shrink-0" />
        <span className="truncate">
          {user.isTourist ? 'Турист в Минске' : user.areaName || 'Минск'}
          {distance && ` · ${distance}`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {goals.map((goal) => (
          <span key={goal.id} className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm2 font-semibold border ${goal.badgeBg} ${goal.badgeBorder} ${goal.badgeText}`}>
            <span>{goal.emoji}</span>
            <span>{goal.label}</span>
          </span>
        ))}
      </div>

      {user.bio && <p className="mt-4 text-body text-zine-ink whitespace-pre-line">{user.bio}</p>}

      {user.isGuide && (
        <div className="mt-4 p-4 rounded-zine-sm bg-zine-sky/10 border border-zine-sky/25">
          <p className="text-body font-bold text-zine-ink">🧭 Покажу город</p>
          <p className="mt-1 text-body text-zine-ink">
            {user.guideAbout || 'С радостью покажу Минск гостям города.'}
          </p>
          <p className="mt-2 text-sm2 text-zine-inkMuted">Бесплатно. Обо всех условиях договаривайтесь лично.</p>
        </div>
      )}

      <div className="mt-5">
        {user.isMatch ? <ChatButton user={user} className="w-full" /> : <ReactionButtons user={user} onReact={onReact} />}
      </div>

      {/* Безопасность */}
      <div className="mt-4 pt-3 border-t border-zine-border flex items-center justify-between gap-2">
        <button onClick={() => setIsTipsOpen(true)} className="h-11 px-1 text-sm2 font-semibold text-zine-inkMuted cursor-pointer">
          🛡 Советы для встречи
        </button>
        <button onClick={() => setIsReportOpen(true)} className="h-11 px-1 text-sm2 font-semibold text-zine-danger cursor-pointer">
          ⚠️ Пожаловаться
        </button>
      </div>

      {isTipsOpen && <SafetyTipsSheet onClose={() => setIsTipsOpen(false)} />}
      {isReportOpen && (
        <ReportSheet
          targetType="user"
          targetId={user.telegramId}
          targetName={user.firstName}
          onClose={() => setIsReportOpen(false)}
          onReported={() => onReported(user)}
        />
      )}
    </BottomSheet>
  );
};
