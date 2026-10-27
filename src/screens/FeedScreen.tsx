import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapPin, SlidersHorizontal, ChevronUp, ChevronLeft, ChevronRight, Send, Loader2, Undo2 } from 'lucide-react';
import { UserProfile, ActivityGoal, goalsOf, commonGoalIds, GOES_WITH, EMPATH, isVentingNow, GoalFilter, matchesGoalFilter, isAvailableNow, formatTime } from '../types';
import { telegramService } from '../services/telegram';
import { ReactionType } from '../components/common/Reactions';
import { formatDistance } from '../components/common/UserBottomSheet';
import { GoalChips } from '../components/ui/GoalChips';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { photoSrc } from '../components/common/PhotoPicker';
import { USERNAME_TEXTS } from '../texts/profile';
import { PHOTO_TEXTS } from '../texts/photos';
import { FEED_TEXTS } from '../texts/feed';
import { UndoToast } from '../components/ui/UndoToast';
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
  onUnmatch?: (user: UserProfile) => Promise<void>;        // «Отменить» в «На связи»
  onSkip?: (user: UserProfile) => void;                    // свайп влево: пропустить на 3 дня
  onUnskip?: (user: UserProfile, index: number) => void;   // «Вернуть»
  isTourist?: boolean;
  selectedGoal: GoalFilter;
  onSelectGoal: (goal: GoalFilter) => void;
  myPrefs: MyPrefs;
  myGoals?: ActivityGoal[]; // подсветить общие интересы
  topSlot?: React.ReactNode; // например, «Первые шаги» для новичков
  myUsername?: string; // нет — подсказываем завести (иначе на связи не напишут)
}

type FeedTab = 'all' | 'likes' | 'matches';

export const FeedScreen: React.FC<FeedScreenProps> = ({
  users,
  likedMe = [],
  matches = [],
  onSelectUser,
  onReact,
  onUnmatch,
  onSkip,
  onUnskip,
  isTourist = false,
  selectedGoal,
  onSelectGoal,
  myPrefs,
  myGoals,
  topSlot,
  myUsername
}) => {
  const [filters, setFilters] = useState<PeopleFilters>(loadFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  useEffect(() => saveFilters(filters), [filters]);
  const activeFilters = countActiveFilters(filters);

  const [tab, setTab] = useState<FeedTab>(likedMe.length > 0 ? 'likes' : 'all');
  // Только что пропущенный — можно вернуть
  const [justSkipped, setJustSkipped] = useState<{ user: UserProfile; index: number } | null>(null);
  // После «Вернуть» — сразу показываем вернувшегося человека
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollToUser, setScrollToUser] = useState<number | null>(null);

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

  useLayoutEffect(() => {
    if (!scrollToUser) return;
    const index = filteredUsers.findIndex((u) => u.telegramId === scrollToUser);
    const list = listRef.current;
    if (index >= 0 && list) {
      setScrollToUser(null);
      list.scrollTo({ top: (index + (hasIntroRef.current ? 1 : 0)) * list.clientHeight });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToUser, filteredUsers.length]);

  const showGuidesBanner = isTourist && tab === 'all' && selectedGoal !== 'guides' && guidesCount > 0;
  const hasIntro = tab === 'all' && (Boolean(topSlot) || showGuidesBanner);
  const hasIntroRef = useRef(hasIntro);
  hasIntroRef.current = hasIntro;
  const hint =
    selectedGoal === 'guides'
      ? '🧭 Покажут город бесплатно. Об условиях договаривайтесь лично.'
      : selectedGoal === 'empaths'
      ? '🫶 Те, кто отметил: умею слушать и поддерживать.'
      : selectedGoal === 'venting'
      ? FEED_TEXTS.ventingHint
      : (tab === 'likes' || tab === 'matches') && !myUsername
      ? USERNAME_TEXTS.feedHint
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
              <p className="text-body text-zine-inkMuted mb-5">Попробуй ослабить фильтры, например увеличить расстояние.</p>
              <button onClick={() => setIsFiltersOpen(true)} className="h-12 px-6 rounded-full bg-zine-terracotta text-white text-body font-bold cursor-pointer">
                Изменить фильтры
              </button>
            </div>
          ) : (
            <EmptyState tab={tab} />
          )}
        </div>
      ) : (
        <div key={`${tab}-${selectedGoal}`} ref={listRef} className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
          {/* Вступление: «Первые шаги» и подсказка туристам */}
          {hasIntro && (
            <section className="relative h-full w-full snap-start snap-always overflow-y-auto no-scrollbar bg-gradient-to-b from-[#2B2623] to-[#141210] px-4 pt-[200px] pb-6 flex flex-col gap-4">
              {topSlot}
              {showGuidesBanner && (
                <section className="p-4 rounded-zine bg-zine-cardElevated border border-zine-sky/25">
                  <p className="text-lead font-bold text-zine-ink">🧳 Впервые в Минске?</p>
                  <p className="mt-1 text-body text-zine-inkMuted">Местные жители готовы показать тебе город бесплатно, просто из любви к Минску. Обо всех условиях договаривайтесь лично.</p>
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
                  <span className="text-cap font-semibold">листай, там люди</span>
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
              myGoals={myGoals}
              onOpen={() => {
                telegramService.haptic('selection');
                onSelectUser(user);
              }}
              onReact={onReact}
              onUnmatch={onUnmatch ? () => onUnmatch(user) : undefined}
              onSkip={() => {
                setJustSkipped({ user, index: users.findIndex((u) => u.telegramId === user.telegramId) });
                onSkip ? onSkip(user) : onReact(user, 'dislike');
              }}
            />
          ))}
        </div>
      )}

      {justSkipped && (
        <UndoToast
          topClass="top-[188px]"
          text={`⏭ ${justSkipped.user.firstName} ${FEED_TEXTS.skipped}`}
          onDone={() => setJustSkipped(null)}
          onUndo={() => {
            onUnskip?.(justSkipped.user, Math.max(0, justSkipped.index));
            setScrollToUser(justSkipped.user.telegramId);
            setJustSkipped(null);
          }}
          secondary={{
            label: FEED_TEXTS.hideForever,
            onClick: () => {
              telegramService.haptic('medium');
              onReact(justSkipped.user, 'dislike');
              setJustSkipped(null);
            }
          }}
        />
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
  myGoals?: ActivityGoal[];
  onOpen: () => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  onSkip: () => void;
  onUnmatch?: () => Promise<void>;
}> = ({ user, isFirst, myGoals, onOpen, onReact, onSkip, onUnmatch }) => {
  const [busy, setBusy] = useState<ReactionType | 'unmatch' | null>(null);
  const [isConfirmingHide, setIsConfirmingHide] = useState(false);
  const [isConfirmingUnmatch, setIsConfirmingUnmatch] = useState(false);
  const common = new Set(commonGoalIds(user, myGoals));
  const goals = goalsOf(user);
  // Главное фото и ещё до 5
  const gallery = [user.avatarUrl, ...(user.photos || []).map(photoSrc)];
  const [photoIndex, setPhotoIndex] = useState(0);
  // Главное фото загрузилось — тихо подгружаем остальные, чтобы листались сразу
  const preloaded = useRef(false);
  const preloadGallery = () => {
    if (preloaded.current || gallery.length < 2) return;
    preloaded.current = true;
    gallery.slice(1).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  };
  const showPhoto = (step: number) => {
    preloadGallery();
    telegramService.haptic('selection');
    setPhotoIndex((i) => (i + step + gallery.length) % gallery.length);
  };
  // Статусы человека: на связи, хочет пообщаться, гид, эмпат, «поныть», «могу сейчас»
  const statuses = [
    user.isMatch && { text: '🤝 На связи', cls: 'bg-zine-sage text-white' },
    user.likedMe && !user.isMatch && { text: '👋 Хочет пообщаться', cls: 'bg-white text-[#2B2623]' },
    isAvailableNow(user) && { text: `⚡ Могу сейчас · до ${formatTime(user.availableUntil)}`, cls: 'bg-[#2FA36B] text-white' },
    isVentingNow(user) && { text: `🫂 Хочется поныть · до ${formatTime(user.ventUntil)}`, cls: 'bg-[#C77D86] text-white' },
    user.isGuide && { text: '🧭 Покажу город', cls: 'bg-zine-sky text-white' },
    user.isEmpath && { text: `${EMPATH.emoji} ${EMPATH.label}`, cls: 'bg-black/45 backdrop-blur text-white' }
  ].filter(Boolean) as { text: string; cls: string }[];
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

  // «Отменить» в «На связи» — сначала спрашиваем
  const unmatch = async () => {
    if (busy || !onUnmatch) return;
    telegramService.haptic('medium');
    setBusy('unmatch');
    try {
      await onUnmatch();
    } catch {
      telegramService.alert(FEED_TEXTS.unmatchFailed);
    } finally {
      setBusy(null);
      setIsConfirmingUnmatch(false);
    }
  };

  return (
    <SwipeReel
      className="bg-[#2B2623]"
      rightLabel={canLike ? '👋 Привет' : undefined}
      leftLabel={user.isMatch ? undefined : FEED_TEXTS.skipStamp}
      leftBehavior="remove"
      onSwipe={(dir) => {
        if (dir === 'right') react('like');
        // Свайп влево — просто «пропустить»: человек вернётся через несколько дней. Скрыть навсегда — кнопкой 🙈
        else onSkip();
      }}
    >
      <img src={gallery[photoIndex] || user.avatarUrl} alt={user.firstName} draggable={false} onClick={onOpen} onLoad={preloadGallery} className="absolute inset-0 h-full w-full object-cover cursor-pointer" loading="lazy" />
      {/* Несколько фото: тап слева и справа листает, как в сторис; по центру — анкета */}
      {gallery.length > 1 && (
        <>
          {/* Стрелки по бокам: видно, что фото листаются. Слой выше нижнего блока — иначе его градиент перехватывает нажатия */}
          <button type="button" aria-label={PHOTO_TEXTS.galleryPrev} onClick={() => showPhoto(-1)} className="absolute left-0 top-[22%] bottom-[45%] w-[30%] z-20 flex items-center justify-start pl-2 cursor-pointer">
            <span className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white/90 flex items-center justify-center">
              <ChevronLeft size={22} />
            </span>
          </button>
          <button type="button" aria-label={PHOTO_TEXTS.galleryNext} onClick={() => showPhoto(1)} className="absolute right-0 top-[22%] bottom-[45%] w-[30%] z-20 flex items-center justify-end pr-2 cursor-pointer">
            <span className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white/90 flex items-center justify-center">
              <ChevronRight size={22} />
            </span>
          </button>
        </>
      )}

      {/* Кнопки справа, как в Reels */}
      <div className="absolute right-3 bottom-48 z-20 flex flex-col items-center gap-5 text-white">
        {user.isMatch ? (
          <>
            {user.username && (
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
            )}
            {onUnmatch && (
              <button
                onClick={() => {
                  telegramService.haptic('warning');
                  setIsConfirmingUnmatch(true);
                }}
                aria-label={FEED_TEXTS.unmatch}
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <span className="w-12 h-12 rounded-full bg-black/35 backdrop-blur flex items-center justify-center">
                  <Undo2 size={22} />
                </span>
                <span className="text-cap font-semibold drop-shadow">{FEED_TEXTS.unmatch}</span>
              </button>
            )}
          </>
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
        {/* Подсказка про жесты — только на первой карточке, в потоке, чтобы не закрывать лицо */}
        {isFirst && (
          <div>
            <SwipeHint inline left={user.isMatch ? undefined : FEED_TEXTS.skipHint} right={canLike ? '👋' : undefined} extra={gallery.length > 1 ? PHOTO_TEXTS.tapHint : undefined} />
          </div>
        )}
        {gallery.length > 1 && (
          <div className="mb-3 pr-16 flex gap-1" aria-hidden>
            {gallery.map((src, i) => (
              <span key={src} className={`h-1 flex-1 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/35'}`} />
            ))}
          </div>
        )}

        {/* Статусы — компактной строкой */}
        {statuses.length > 0 && (
          <div data-no-swipe className="mr-16 flex gap-1.5 overflow-x-auto no-scrollbar">
            {statuses.map((st) => (
              <span key={st.text} className={`h-7 px-2.5 shrink-0 whitespace-nowrap rounded-full text-cap font-bold flex items-center ${st.cls}`}>
                {st.text}
              </span>
            ))}
          </div>
        )}

        <h2 className="mt-1.5 pr-16 flex items-center gap-1 font-serif font-bold text-display leading-tight">
          <span className="truncate">
            {user.firstName}
            {user.age ? <span className="font-sans font-medium text-white/80">, {user.age}</span> : null}
          </span>
          <ChevronRight size={26} className="shrink-0 text-white/70" aria-hidden />
        </h2>
        <p className="mt-0.5 pr-16 flex items-center gap-1.5 text-sm2 text-white/85">
          <MapPin size={16} className="shrink-0" />
          <span className="truncate">
            {user.isTourist ? 'В Минске проездом' : user.areaName || 'Минск'}
            {distance && ` · ${distance}`}
          </span>
        </p>
        <div data-no-swipe className="mt-2 -mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar fade-right">
          {/* Общие со мной интересы — первыми и ярче, затем «обычно хожу» и остальное */}
          {goals.filter((g) => common.has(g.id)).map((goal) => (
            <span key={goal.id} className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full bg-zine-mustard text-[#2B2623] text-sm2 font-bold flex items-center gap-1.5">
              ✨ {goal.emoji} {goal.label}
            </span>
          ))}
          {user.goesWith && GOES_WITH[user.goesWith] && (
            <span className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full bg-white text-[#2B2623] text-sm2 font-semibold flex items-center gap-1.5">
              {GOES_WITH[user.goesWith].emoji} {GOES_WITH[user.goesWith].label}
            </span>
          )}
          {goals.filter((g) => !common.has(g.id)).map((goal) => (
            <span key={goal.id} className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full bg-white/20 backdrop-blur text-sm2 font-semibold flex items-center gap-1.5">
              {goal.emoji} {goal.label}
            </span>
          ))}
        </div>
        {user.bio && <p className="mt-2 pr-16 text-body text-white/90 line-clamp-2">{user.bio}</p>}

        {isConfirmingUnmatch ? (
          <div className="mt-3 p-3 rounded-zine-sm bg-black/50 backdrop-blur">
            <p className="text-sm2 mb-2.5">{FEED_TEXTS.unmatchConfirm}</p>
            <div className="flex gap-2">
              <button onClick={unmatch} className="flex-1 h-12 rounded-full bg-zine-danger text-white text-body font-bold flex items-center justify-center cursor-pointer">
                {busy === 'unmatch' ? <Loader2 size={20} className="animate-spin" /> : FEED_TEXTS.unmatchYes}
              </button>
              <button onClick={() => setIsConfirmingUnmatch(false)} className="flex-1 h-12 rounded-full bg-white text-[#2B2623] text-body font-semibold cursor-pointer">
                {FEED_TEXTS.unmatchNo}
              </button>
            </div>
          </div>
        ) : isConfirmingHide ? (
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
        ) : null}
        {user.isMatch && !user.username && <p className="mt-2 text-cap text-white/70">🤝 У человека нет @username, ссылку прислал бот в чате.</p>}
      </div>

    </SwipeReel>
  );
};

const EmptyState: React.FC<{ tab: FeedTab }> = ({ tab }) => {
  const content = {
    likes: { emoji: '👋', title: 'Пока никто не передал привет', text: 'Когда кто-то захочет пообщаться, он появится здесь, а бот пришлёт уведомление.' },
    matches: { emoji: '🤝', title: 'Пока никого на связи', text: 'Нажимай 👋 на анкетах. Когда человек ответит тем же, здесь появится кнопка «Написать».' },
    all: { emoji: '🗺', title: 'Здесь пока никого', text: 'Позови друзей, вместе веселее. А ещё загляни чуть позже.' }
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
