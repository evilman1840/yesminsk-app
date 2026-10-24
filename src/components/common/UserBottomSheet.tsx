import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { UserProfile, ActivityGoal, goalsOf, commonGoalIds, GOES_WITH, EMPATH, isVentingNow, isAvailableNow, formatTime } from '../../types';
import { ReactionButtons, ChatButton, ReactionType } from './Reactions';
import { BottomSheet } from '../ui/BottomSheet';
import { ReportSheet, SafetyTipsSheet } from './ReportSheet';
import { photoSrc } from './PhotoPicker';

interface UserBottomSheetProps {
  user: UserProfile;
  myGoals?: ActivityGoal[]; // чтобы подсветить общие интересы
  onClose: () => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  onReported: (user: UserProfile) => void;
}

export const formatDistance = (meters?: number) => {
  if (!meters) return null;
  return meters < 1000 ? `${Math.round(meters / 50) * 50 || 50} м` : `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="mb-2 text-cap font-bold uppercase tracking-wide text-zine-inkMuted">{children}</h4>
);

/**
 * Анкета человека во всплывающей шторке (с карты и из ленты):
 * фото с именем, статусы, общее со мной, о себе, интересы; кнопки 👋 / «Написать» закреплены внизу
 */
export const UserBottomSheet: React.FC<UserBottomSheetProps> = ({ user, myGoals, onClose, onReact, onReported }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);

  const common = new Set(commonGoalIds(user, myGoals));
  // Общие интересы — первыми
  const goals = goalsOf(user).sort((a, b) => Number(common.has(b.id)) - Number(common.has(a.id)));
  const commonGoals = goals.filter((g) => common.has(g.id));
  const distance = formatDistance(user.distanceMeters);
  const gallery = [user.avatarUrl, ...(user.photos || []).map(photoSrc)];
  const [photoIndex, setPhotoIndex] = useState(0);
  const goesWith = user.goesWith && GOES_WITH[user.goesWith];

  return (
    <BottomSheet
      onClose={onClose}
      footer={user.isMatch ? <ChatButton user={user} className="w-full" /> : <ReactionButtons user={user} onReact={onReact} />}
    >
      {/* Фото с именем поверх */}
      <div className="relative -mt-1 rounded-zine overflow-hidden bg-zine-card">
        {/* Главное фото и ещё до 5: листаются пальцем */}
        <div
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => setPhotoIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {gallery.map((src) => (
            <img key={src} src={src} alt={user.firstName} className="w-full shrink-0 snap-center aspect-[4/5] max-h-[52vh] object-cover" loading="lazy" />
          ))}
        </div>
        {gallery.length > 1 && (
          <div className="absolute top-2 inset-x-3 flex gap-1 pointer-events-none" aria-hidden>
            {gallery.map((src, i) => (
              <span key={src} className={`h-1 flex-1 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/45'}`} />
            ))}
          </div>
        )}
        <div className="absolute top-5 left-3 right-3 flex flex-wrap gap-1.5 pointer-events-none">
          {user.isMatch && <span className="px-3 py-1 rounded-full bg-zine-sage text-white text-sm2 font-bold shadow">🤝 На связи</span>}
          {user.likedMe && !user.isMatch && <span className="px-3 py-1 rounded-full bg-white text-zine-ink text-sm2 font-bold shadow">👋 Хочет пообщаться</span>}
          {user.isGuide && <span className="px-3 py-1 rounded-full bg-zine-sky text-white text-sm2 font-bold shadow">🧭 Покажу город</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pt-16 pb-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white pointer-events-none">
          <h3 className="font-serif font-bold text-display leading-tight">
            {user.firstName}
            {user.age ? <span className="font-sans font-medium text-white/85">, {user.age}</span> : null}
          </h3>
          {user.isEmpath && (
            <p className="mt-0.5 text-sm2 font-semibold text-white/90">
              {EMPATH.emoji} {EMPATH.label}: умею слушать и поддерживать
            </p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-sm2 text-white/85">
            <MapPin size={16} className="shrink-0" />
            <span className="truncate">
              {user.isTourist ? 'В Минске проездом' : user.areaName || 'Минск'}
              {distance && ` · ${distance}`}
            </span>
          </p>
          {user.activeRecently && (
            <p className="mt-1 flex items-center gap-2 text-cap font-semibold text-white/85">
              <span className="w-2 h-2 rounded-full bg-[#4ADE80]" />
              Недавно в приложении
            </p>
          )}
        </div>
      </div>

      {/* Статусы «прямо сейчас» */}
      {isAvailableNow(user) && (
        <p className="mt-3 p-3 rounded-zine-sm bg-[#2FA36B]/15 text-body text-zine-ink">
          <b>⚡ Могу сейчас</b> · до {formatTime(user.availableUntil)}. Можно встретиться прямо сегодня.
        </p>
      )}
      {isVentingNow(user) && (
        <p className="mt-3 p-3 rounded-zine-sm bg-zine-blush/20 text-body text-zine-ink">
          <b>🫂 Хочется поныть</b> · до {formatTime(user.ventUntil)}. Передай 👋, можно поддержать без советов и оценок.
        </p>
      )}

      {commonGoals.length > 0 && (
        <p className="mt-3 p-3 rounded-zine-sm bg-zine-mustard/15 text-body text-zine-ink">
          <b>✨ У вас общее:</b> {commonGoals.map((g) => `${g.emoji} ${g.label.toLowerCase()}`).join(', ')}
        </p>
      )}

      {user.bio && (
        <section className="mt-5">
          <SectionTitle>О себе</SectionTitle>
          <p className="text-body text-zine-ink whitespace-pre-line">{user.bio}</p>
        </section>
      )}

      <section className="mt-5">
        <SectionTitle>Чем хочется заняться</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {goals.map((goal) => (
            <span
              key={goal.id}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm2 font-semibold border ${goal.badgeBg} ${goal.badgeBorder} ${goal.badgeText} ${
                common.has(goal.id) ? 'ring-2 ring-zine-mustard/60' : ''
              }`}
            >
              <span>{goal.emoji}</span>
              <span>{goal.label}</span>
              {common.has(goal.id) && <span aria-label="общее">✨</span>}
            </span>
          ))}
        </div>
        {goesWith && (
          <p className="mt-3 text-body text-zine-ink">
            {goesWith.emoji} Обычно хожу: <b>{goesWith.label.toLowerCase()}</b>
          </p>
        )}
      </section>

      {user.isGuide && (
        <section className="mt-5 p-4 rounded-zine-sm bg-zine-sky/10 border border-zine-sky/25">
          <p className="text-body font-bold text-zine-ink">🧭 Покажу город</p>
          <p className="mt-1 text-body text-zine-ink">{user.guideAbout || 'С радостью покажу Минск гостям города.'}</p>
          <p className="mt-2 text-sm2 text-zine-inkMuted">Бесплатно. Обо всех условиях договаривайтесь лично.</p>
        </section>
      )}

      {!user.isMatch && (
        <p className="mt-5 text-sm2 text-zine-inkMuted">
          Нажми 👋. Если человек ответит тем же, вы окажетесь «На связи» и сможете написать друг другу.
        </p>
      )}
      {user.isMatch && !user.username && <p className="mt-5 text-sm2 text-zine-inkMuted">🤝 У человека нет @username, ссылку прислал бот в чате.</p>}

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
