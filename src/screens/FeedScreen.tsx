import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { UserProfile, GOALS_CONFIG, GoalFilter, matchesGoalFilter, isAvailableNow, formatTime } from '../types';
import { telegramService } from '../services/telegram';
import { ReactionButtons, ChatButton, ReactionType } from '../components/common/Reactions';
import { formatDistance } from '../components/common/UserBottomSheet';
import { GoalChips } from '../components/ui/GoalChips';

export interface FeedScreenProps {
  users: UserProfile[];
  likedMe?: UserProfile[];
  matches?: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  isTourist?: boolean;
  selectedGoal: GoalFilter;
  onSelectGoal: (goal: GoalFilter) => void;
}

type FeedTab = 'all' | 'likes' | 'matches';

export const FeedScreen: React.FC<FeedScreenProps> = ({
  users,
  likedMe = [],
  matches = [],
  onSelectUser,
  onReact,
  isTourist = false,
  selectedGoal,
  onSelectGoal
}) => {
  const [tab, setTab] = useState<FeedTab>(likedMe.length > 0 ? 'likes' : 'all');

  const tabUsers = tab === 'likes' ? likedMe : tab === 'matches' ? matches : users;
  const filteredUsers = tabUsers.filter((u) => matchesGoalFilter(u, selectedGoal));
  const guidesCount = users.filter((u) => u.isGuide).length;

  const tabs: { id: FeedTab; label: string; count: number }[] = [
    { id: 'all', label: 'Рядом', count: 0 },
    { id: 'likes', label: 'Хотят', count: likedMe.length },
    { id: 'matches', label: 'На связи', count: matches.length }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-zine-paper overflow-hidden">
      <header className="shrink-0 px-5 pt-5 pb-3 space-y-4">
        <h1 className="font-serif font-bold text-display text-zine-ink">Люди</h1>

        {/* Вкладки: рядом / хотят пообщаться / на связи */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-zine bg-zine-card">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                telegramService.haptic('selection');
                setTab(t.id);
              }}
              className={`h-11 rounded-[14px] text-sm2 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === t.id ? 'bg-zine-cardElevated text-zine-ink shadow-zine-sm' : 'text-zine-inkMuted'
              }`}
            >
              <span className="truncate">{t.label}</span>
              {t.count > 0 && (
                <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-zine-terracotta text-white text-cap font-bold flex items-center justify-center">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="shrink-0 pb-3">
        <GoalChips value={selectedGoal} onChange={onSelectGoal} />
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {/* Туристам — местные, которые готовы показать город */}
        {isTourist && tab === 'all' && selectedGoal !== 'guides' && guidesCount > 0 && (
          <section className="p-4 rounded-zine bg-zine-sky/10 border border-zine-sky/25">
            <p className="text-lead font-bold text-zine-ink">🧳 Впервые в Минске?</p>
            <p className="mt-1 text-body text-zine-inkMuted">Местные жители готовы показать тебе город — бесплатно, просто из любви к Минску.</p>
            <button
              onClick={() => {
                telegramService.haptic('selection');
                onSelectGoal('guides');
              }}
              className="mt-3 w-full h-12 rounded-zine-sm bg-zine-sky text-white text-body font-bold cursor-pointer"
            >
              🧭 Кто покажет город ({guidesCount})
            </button>
          </section>
        )}

        {selectedGoal === 'guides' && (
          <p className="px-1 text-sm2 text-zine-inkMuted">
            🧭 Местные, которые с радостью покажут город. Нажми 👋 «Пообщаться», чтобы договориться о прогулке.
          </p>
        )}

        {tab === 'likes' && filteredUsers.length > 0 && (
          <p className="px-1 text-sm2 text-zine-inkMuted">
            Эти люди хотят с тобой пообщаться. Нажми 👋 в ответ — и сможете написать друг другу.
          </p>
        )}

        {filteredUsers.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          filteredUsers.map((user) => {
            const goal = GOALS_CONFIG[user.goal] || GOALS_CONFIG.walk;
            const distance = formatDistance(user.distanceMeters);

            return (
              <article
                key={user.id}
                onClick={() => {
                  telegramService.haptic('selection');
                  onSelectUser(user);
                }}
                className="rounded-zine bg-zine-cardElevated border border-zine-border shadow-zine-sm overflow-hidden cursor-pointer active:scale-[0.995] transition-transform"
              >
                <div className="relative">
                  <img src={user.avatarUrl} alt={user.firstName} className="w-full aspect-[16/10] object-cover bg-zine-card" />
                  {user.likedMe && !user.isMatch && (
                    <span className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-zine-cardElevated/95 text-zine-ink text-sm2 font-bold shadow-zine-sm">
                      👋 Хочет пообщаться
                    </span>
                  )}
                  {user.isMatch && (
                    <span className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-zine-sage text-white text-sm2 font-bold shadow-zine-sm">
                      🤝 На связи
                    </span>
                  )}
                  {user.isGuide && (
                    <span className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-zine-sky text-white text-sm2 font-bold shadow-zine-sm">
                      🧭 Покажу город
                    </span>
                  )}
                  {isAvailableNow(user) && (
                    <span className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-[#2FA36B] text-white text-sm2 font-bold shadow-zine-sm">
                      ⚡ Могу сейчас · до {formatTime(user.availableUntil)}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-serif font-bold text-title text-zine-ink">
                    {user.firstName}
                    {user.age ? <span className="font-sans font-medium text-zine-inkMuted">, {user.age}</span> : null}
                  </h3>

                  <div className="flex items-center gap-1.5 mt-1 text-sm2 text-zine-inkMuted">
                    <MapPin size={17} className="text-zine-terracotta shrink-0" />
                    <span className="truncate">
                      {user.isTourist ? 'Турист в Минске' : user.areaName || 'Минск'}
                      {distance && ` · ${distance}`}
                    </span>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-sm2 font-semibold border ${goal.badgeBg} ${goal.badgeBorder} ${goal.badgeText}`}>
                    <span>{goal.emoji}</span>
                    <span>{goal.label}</span>
                  </span>

                  {user.bio && <p className="mt-3 text-body text-zine-ink line-clamp-2">{user.bio}</p>}

                  <div className="mt-4">
                    {user.isMatch ? <ChatButton user={user} className="w-full" /> : <ReactionButtons user={user} onReact={onReact} />}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
};

const EmptyState: React.FC<{ tab: FeedTab }> = ({ tab }) => {
  const content = {
    likes: { emoji: '👋', title: 'Пока никто не передал привет', text: 'Когда кто-то захочет пообщаться, он появится здесь, а бот пришлёт уведомление.' },
    matches: { emoji: '🤝', title: 'Пока никого на связи', text: 'Нажимай 👋 на анкетах. Когда человек ответит тем же, здесь появится кнопка «Написать».' },
    all: { emoji: '🗺', title: 'Здесь пока никого', text: 'Попробуй выбрать другую цель или загляни чуть позже.' }
  }[tab];

  return (
    <div className="mt-6 p-8 rounded-zine bg-zine-card text-center">
      <div className="text-[44px] mb-3">{content.emoji}</div>
      <h3 className="font-serif font-bold text-title text-zine-ink mb-2">{content.title}</h3>
      <p className="text-body text-zine-inkMuted">{content.text}</p>
    </div>
  );
};

export default FeedScreen;
