import React, { useEffect, useState } from 'react';
import { MapPin, SlidersHorizontal, ChevronUp, Send, Loader2 } from 'lucide-react';
import { UserProfile, goalsOf, GOES_WITH, EMPATH, isVentingNow, GoalFilter, matchesGoalFilter, isAvailableNow, formatTime } from '../types';
import { telegramService } from '../services/telegram';
import { ReactionType } from '../components/common/Reactions';
import { formatDistance } from '../components/common/UserBottomSheet';
import { GoalChips } from '../components/ui/GoalChips';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import {
  PeopleFiltersSheet,
  PeopleFilters,
  MyPrefs,
  loadFilters,
  saveFilters,
  applyPeopleFilters,
  countActiveFilters
} from '../components/people/PeopleFilters';

export interface FeedScreenProps {
  users: UserProfile[];
  likedMe?: UserProfile[];
  matches?: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  isTourist?: boolean;
  selectedGoal: GoalFilter;
  onSelectGoal: (goal: GoalFilter) => void;
  myPrefs: MyPrefs;
  topSlot?: React.ReactNode; // например, «Первые шаги» для новичков
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
  onSelectGoal,
  myPrefs,
  topSlot
}) => {
  const [filters, setFilters] = useState<PeopleFilters>(loadFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  useEffect(() => saveFilters(filters), [filters]);
  const activeFilters = countActiveFilters(filters);

  const [tab, setTab] = useState<FeedTab>(likedMe.length > 0 ? 'likes' : 'all');

  // Фильтры действуют на «Рядом»; тех, кто уже хочет пообщаться или на связи, не прячем
  const nearbyFiltered = applyPeopleFilters(users, filters, myPrefs);
  const tabUsers = tab === 'likes' ? likedMe : tab === 'matches' ? matches : nearbyFiltered;
  const filteredUsers = tabUsers.filter((u) => matchesGoalFilter(u, selectedGoal));
  const guidesCount = users.filter((u) => u.isGuide).length;

  const tabs: { id: FeedTab; label: string; count: number }[] = [
    { id: 'all', label: 'Рядом', count: 0 },
    { id: 'likes', label: 'Хотят', count: likedMe.length },
    { id: 'matches', label: 'На связи', count: matches.length }
  ];

  const showGuidesBanner = isTourist && tab === 'all' && selectedGoal !== 'guides' && guidesCount > 0;
  const hasIntro = tab === 'all' && (Boolean(topSlot) || showGuidesBanner);
  const hint =
    selectedGoal === 'guides'
      ? '🧭 Покажут город бесплатно. Об условиях договаривайтесь лично.'
      : selectedGoal === 'empaths'
      ? '🫶 Те, кто отметил: умею слушать и поддерживать.'
      : tab === 'likes' && filteredUsers.length > 0
      ? 'Хотят пообщаться — нажми 👋 в ответ, и сможете написать.'
      : '';

  return (
    <div className="relative h-full w-full bg-[#141210] overflow-hidden">
      {/* Заголовок, вкладки и фильтры поверх карточек */}
      <div className="absolute top-0 inset-x-0 z-20 pt-3 pb-6 bg-gradient-to-b from-black/70 via-black/40 to-transparent">
        <div className="px-4 flex items-center justify-between gap-3">
          <h1 className="font-serif font-bold text-title text-white">Люди</h1>
          <button
            onClick={() => {
              telegramService.haptic('selection');
              setIsFiltersOpen(true);
            }}
            className={`h-11 px-4 rounded-full text-sm2 font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeFilters > 0 ? 'bg-white text-[#2B2623]' : 'bg-black/35 backdrop-blur text-white'
            }`}
          >
            <SlidersHorizontal size={18} />
            <span>Фильтры</span>
            {activeFilters > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-zine-terracotta text-white text-cap font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Вкладки: рядом / хотят пообщаться / на связи */}
        <div className="mx-4 mt-2 grid grid-cols-3 gap-1 p-1 rounded-full bg-black/35 backdrop-blur">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                telegramService.haptic('selection');
                setTab(t.id);
              }}
              className={`h-10 rounded-full text-sm2 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === t.id ? 'bg-white text-[#2B2623]' : 'text-white/85'
              }`}
            >
              <span className="truncate">{t.label}</span>
              {t.count > 0 && (
                <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-zine-terracotta text-white text-cap font-bold flex items-center justify-center">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-2">
          <GoalChips value={selectedGoal} onChange={onSelectGoal} floating />
        </div>
        {hint && <p className="mt-2 px-4 text-cap font-semibold text-white/85 drop-shadow">{hint}</p>}
      </div>

      {filteredUsers.length === 0 && !hasIntro ? (
        <div className="h-full flex flex-col items-center justify-center px-6 pt-40">
          {tab === 'all' && activeFilters > 0 && users.length > 0 ? (
            <div className="w-full p-8 rounded-zine bg-zine-card text-center">
              <div className="text-[44px] mb-3">🔍</div>
              <h3 className="font-serif font-bold text-title text-zine-ink mb-2">Под фильтры никто не подходит</h3>
              <p className="text-body text-zine-inkMuted mb-5">Попробуй ослабить фильтры — например, увеличить расстояние.</p>
              <button onClick={() => setIsFiltersOpen(true)} className="h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer">
                Изменить фильтры
              </button>
            </div>
          ) : (
            <EmptyState tab={tab} />
          )}
        </div>
      ) : (
        <div key={`${tab}-${selectedGoal}`} className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
          {/* Вступление: «Первые шаги» и подсказка туристам */}
          {hasIntro && (
            <section className="relative h-full w-full snap-start snap-always overflow-y-auto no-scrollbar bg-gradient-to-b from-[#2B2623] to-[#141210] px-4 pt-[200px] pb-6 flex flex-col gap-4">
              {topSlot}
              {showGuidesBanner && (
                <section className="p-4 rounded-zine bg-zine-cardElevated border border-zine-sky/25">
                  <p className="text-lead font-bold text-zine-ink">🧳 Впервые в Минске?</p>
                  <p className="mt-1 text-body text-zine-inkMuted">Местные жители готовы показать тебе город — бесплатно, просто из любви к Минску. Обо всех условиях договаривайтесь лично.</p>
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
              {filteredUsers.length > 0 ? (
                <div className="mt-auto flex flex-col items-center text-white/80 animate-bounce pointer-events-none">
                  <ChevronUp size={22} />
                  <span className="text-cap font-semibold">листай — там люди</span>
                </div>
              ) : (
                <EmptyState tab={tab} />
              )}
            </section>
          )}

          {filteredUsers.map((user, index) => (
            <PersonReel
              key={user.id}
              user={user}
              isFirst={index === 0 && !hasIntro}
              onOpen={() => {
                telegramService.haptic('selection');
                onSelectUser(user);
              }}
              onReact={onReact}
            />
          ))}
        </div>
      )}

      {isFiltersOpen && (
        <PeopleFiltersSheet
          value={filters}
          onChange={setFilters}
          resultCount={applyPeopleFilters(users, filters, myPrefs).filter((u) => matchesGoalFilter(u, selectedGoal)).length}
          onClose={() => setIsFiltersOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * Человек как Reels: фото на весь экран, 👋 и 🙈 справа, имя и о себе внизу
 */
const PersonReel: React.FC<{
  user: UserProfile;
  isFirst: boolean;
  onOpen: () => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
}> = ({ user, isFirst, onOpen, onReact }) => {
  const [busy, setBusy] = useState<ReactionType | null>(null);
  const [isConfirmingHide, setIsConfirmingHide] = useState(false);
  const goals = goalsOf(user);
  const canLike = !user.isMatch && !user.iLiked;
  const distance = formatDistance(user.distanceMeters);

  // «Скрыть» убирает человека навсегда — сначала спрашиваем
  const react = async (type: ReactionType) => {
    if (busy) return;
    if (type === 'dislike' && !isConfirmingHide) {
      telegramService.haptic('warning');
      setIsConfirmingHide(true);
      return;
    }
    telegramService.haptic(type === 'like' ? 'success' : 'medium');
    setBusy(type);
    try {
      await onReact(user, type);
    } finally {
      setBusy(null);
      setIsConfirmingHide(false);
    }
  };

  return (
    <SwipeReel
      className="bg-[#2B2623]"
      rightLabel={canLike ? '👋 Привет' : undefined}
      leftLabel={user.isMatch ? undefined : '🙈 Скрыть'}
      leftBehavior="remove"
      onSwipe={(dir) => {
        if (dir === 'right') react('like');
        // Свайп влево — уже осознанное действие, без лишнего подтверждения
        else onReact(user, 'dislike');
      }}
    >
      <img src={user.avatarUrl} alt={user.firstName} draggable={false} onClick={onOpen} className="absolute inset-0 h-full w-full object-cover cursor-pointer" loading="lazy" />

      {/* Кнопки справа, как в Reels */}
      <div className="absolute right-3 bottom-48 z-20 flex flex-col items-center gap-5 text-white">
        {user.isMatch ? (
          user.username && (
            <button
              onClick={() => {
                telegramService.haptic('medium');
                telegramService.openChat(user.username);
              }}
              aria-label="Написать в Telegram"
              className="flex flex-col items-center gap-1 cursor-pointer"
            >
              <span className="w-12 h-12 rounded-full bg-zine-terracotta flex items-center justify-center">
                <Send size={22} />
              </span>
              <span className="text-cap font-semibold drop-shadow">Написать</span>
            </button>
          )
        ) : (
          <>
            <button
              onClick={() => react('like')}
              disabled={user.iLiked}
              aria-label={user.iLiked ? 'Привет отправлен' : 'Пообщаться'}
              className="flex flex-col items-center gap-1 cursor-pointer"
            >
              <span className={`w-12 h-12 rounded-full flex items-center justify-center text-[24px] leading-none ${user.iLiked ? 'bg-zine-sage' : 'bg-zine-terracotta'}`}>
                {busy === 'like' ? <Loader2 size={22} className="animate-spin" /> : '👋'}
              </span>
              <span className="text-cap font-semibold drop-shadow">{user.iLiked ? 'Отправлен' : 'Пообщаться'}</span>
            </button>
            <button onClick={() => react('dislike')} aria-label="Скрыть" className="flex flex-col items-center gap-1 cursor-pointer">
              <span className="w-12 h-12 rounded-full bg-black/35 backdrop-blur flex items-center justify-center text-[22px] leading-none">🙈</span>
              <span className="text-cap font-semibold drop-shadow">Скрыть</span>
            </button>
          </>
        )}
      </div>

      {/* Текст внизу на затемнении; нажатие мимо кнопок — анкета */}
      <div
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) onOpen();
        }}
        className="absolute inset-x-0 bottom-0 z-10 px-4 pt-24 pb-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent text-white cursor-pointer"
      >
        <div className="pr-16 flex flex-wrap gap-1.5">
          {user.isMatch && <span className="px-3 py-1 rounded-full bg-zine-sage text-white text-sm2 font-bold">🤝 На связи</span>}
          {user.likedMe && !user.isMatch && <span className="px-3 py-1 rounded-full bg-white text-[#2B2623] text-sm2 font-bold">👋 Хочет пообщаться</span>}
          {user.isGuide && <span className="px-3 py-1 rounded-full bg-zine-sky text-white text-sm2 font-bold">🧭 Покажу город</span>}
          {isVentingNow(user) && (
            <span className="px-3 py-1 rounded-full bg-[#C77D86] text-white text-sm2 font-bold">🫂 Хочется поныть · до {formatTime(user.ventUntil)}</span>
          )}
          {isAvailableNow(user) && (
            <span className="px-3 py-1 rounded-full bg-[#2FA36B] text-white text-sm2 font-bold">⚡ Могу сейчас · до {formatTime(user.availableUntil)}</span>
          )}
        </div>

        <h2 className="mt-2 pr-16 font-serif font-bold text-display leading-tight">
          {user.firstName}
          {user.age ? <span className="font-sans font-medium text-white/80">, {user.age}</span> : null}
          {/* «Эмпат» — подписью рядом с возрастом, без лишней плашки */}
          {user.isEmpath && (
            <span className="font-sans font-medium text-white/80 whitespace-nowrap">
              {' · '}
              {EMPATH.emoji} {EMPATH.label.toLowerCase()}
            </span>
          )}
        </h2>
        <p className="mt-1 pr-16 flex items-center gap-1.5 text-sm2 text-white/85">
          <MapPin size={16} className="shrink-0" />
          <span className="truncate">
            {user.isTourist ? 'В Минске проездом' : user.areaName || 'Минск'}
            {distance && ` · ${distance}`}
          </span>
        </p>
        <div data-no-swipe className="mt-2 -mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar fade-right">
          {user.goesWith && GOES_WITH[user.goesWith] && (
            <span className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full bg-white text-[#2B2623] text-sm2 font-semibold flex items-center gap-1.5">
              {GOES_WITH[user.goesWith].emoji} {GOES_WITH[user.goesWith].label}
            </span>
          )}
          {goals.map((goal) => (
            <span key={goal.id} className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full bg-white/20 backdrop-blur text-sm2 font-semibold flex items-center gap-1.5">
              {goal.emoji} {goal.label}
            </span>
          ))}
        </div>
        {user.bio && <p className="mt-2 pr-16 text-body text-white/90 line-clamp-2">{user.bio}</p>}

        {isConfirmingHide ? (
          <div className="mt-3 p-3 rounded-zine-sm bg-black/50 backdrop-blur">
            <p className="text-sm2 mb-2.5">🙈 Скрыть навсегда? Вы больше не увидите друг друга.</p>
            <div className="flex gap-2">
              <button
                onClick={() => react('dislike')}
                className="flex-1 h-12 rounded-full bg-zine-danger text-white text-body font-bold flex items-center justify-center cursor-pointer"
              >
                {busy ? <Loader2 size={20} className="animate-spin" /> : 'Да, скрыть'}
              </button>
              <button onClick={() => setIsConfirmingHide(false)} className="flex-1 h-12 rounded-full bg-white text-[#2B2623] text-body font-semibold cursor-pointer">
                Нет
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpen}
            className="mt-3 h-12 px-5 rounded-full bg-white text-[#2B2623] text-body font-bold cursor-pointer active:scale-[0.98] transition-transform"
          >
            Анкета
          </button>
        )}
        {user.isMatch && !user.username && <p className="mt-2 text-cap text-white/70">🤝 У человека нет @username — ссылку прислал бот в чате.</p>}
      </div>

      {/* Подсказка про свайпы — только на первой карточке */}
      {isFirst && <SwipeHint left={user.isMatch ? undefined : 'скрыть'} right={canLike ? '👋' : undefined} className="top-52" />}
    </SwipeReel>
  );
};

const EmptyState: React.FC<{ tab: FeedTab }> = ({ tab }) => {
  const content = {
    likes: { emoji: '👋', title: 'Пока никто не передал привет', text: 'Когда кто-то захочет пообщаться, он появится здесь, а бот пришлёт уведомление.' },
    matches: { emoji: '🤝', title: 'Пока никого на связи', text: 'Нажимай 👋 на анкетах. Когда человек ответит тем же, здесь появится кнопка «Написать».' },
    all: { emoji: '🗺', title: 'Здесь пока никого', text: 'Позови друзей — вместе веселее. А ещё загляни чуть позже.' }
  }[tab];

  return (
    <div className="mt-6 p-8 rounded-zine bg-zine-card text-center">
      <div className="text-[44px] mb-3">{content.emoji}</div>
      <h3 className="font-serif font-bold text-title text-zine-ink mb-2">{content.title}</h3>
      <p className="text-body text-zine-inkMuted">{content.text}</p>
      {tab === 'all' && (
        <button
          onClick={() => telegramService.shareApp()}
          className="mt-5 h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer"
        >
          💌 Позвать друзей
        </button>
      )}
    </div>
  );
};

export default FeedScreen;
