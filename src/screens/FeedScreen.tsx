import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapPin, SlidersHorizontal, ChevronUp, ChevronLeft, ChevronRight, Send, Loader2, Undo2, X } from 'lucide-react';
import { UserProfile, ActivityGoal, goalsOf, commonGoalIds, GOES_WITH, isVentingNow, GoalFilter, matchesGoalFilter, isAvailableNow, formatTime } from '../types';
import { telegramService } from '../services/telegram';
import { ReactionType } from '../components/common/Reactions';
import { goalFilterItems } from '../components/ui/GoalChips';
import { SwipeReel, SwipeHint } from '../components/ui/SwipeReel';
import { photoSrc } from '../components/common/PhotoPicker';
import { USERNAME_TEXTS } from '../texts/profile';
import { PHOTO_TEXTS } from '../texts/photos';
import { FEED_TEXTS } from '../texts/feed';
import { UndoToast } from '../components/ui/UndoToast';
import { markPersonSeen } from '../utils/seenPeople';
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
  onOpenWishKind?: (kind: string, sport?: string) => void; // нажали «Тоже хочет: …» — кто ещё хочет и «Собрать сходку»
  isTourist?: boolean;
  selectedGoal: GoalFilter;
  onSelectGoal: (goal: GoalFilter) => void;
  myPrefs: MyPrefs;
  myGoals?: ActivityGoal[]; // подсветить общие интересы
  topSlot?: React.ReactNode; // например, «Первые шаги» для новичков
  myUsername?: string; // нет — подсказываем завести (иначе на связи не напишут)
  wantNowSlot?: React.ReactNode; // «⚡ Хочу сейчас» слева в шапке
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
  myUsername,
  onOpenWishKind,
  wantNowSlot
}) => {
  const [filters, setFilters] = useState<PeopleFilters>(loadFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  useEffect(() => saveFilters(filters), [filters]);
  // Цель встречи выбирается в той же шторке — считаем её вместе с фильтрами
  const activeFilters = countActiveFilters(filters) + Number(selectedGoal !== 'all');
  const activeGoal = selectedGoal !== 'all' ? goalFilterItems().find((g) => g.id === selectedGoal) : undefined;

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
    <div className="h-full w-full bg-[#141210] flex flex-col overflow-hidden">
      {/* Шапка на однотонном фоне, чтобы фото было чистым. Название экрана уже есть в нижнем меню */}
      <div className="shrink-0 px-3 pt-3 pb-3">
        <div className="flex items-center gap-1.5">
          {wantNowSlot}

          {/* Вкладки: рядом / хотят пообщаться / на связи */}
          <div className="flex-1 min-w-0 flex gap-0.5 p-[3px] rounded-full bg-white/10">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  telegramService.haptic('selection');
                  setTab(t.id);
                }}
                className={`flex-auto min-w-0 h-[38px] px-1 rounded-full text-[14px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  tab === t.id ? 'bg-white text-[#2B2623]' : 'text-white/80'
                }`}
              >
                <span className="truncate">{t.label}</span>
                {t.count > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-zine-terracotta text-white text-[11px] font-bold flex items-center justify-center">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              telegramService.haptic('selection');
              setIsFiltersOpen(true);
            }}
            aria-label={activeFilters > 0 ? `Фильтры: ${activeFilters}` : 'Фильтры'}
            className={`relative w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              activeFilters > 0 ? 'bg-white text-[#2B2623]' : 'bg-white/10 text-white'
            }`}
          >
            <SlidersHorizontal size={20} />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-zine-terracotta text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Выбранная цель — видно, что список отфильтрован; крестик сбрасывает */}
        {activeGoal && (
          <button
            onClick={() => {
              telegramService.haptic('selection');
              onSelectGoal('all');
            }}
            className="mt-2.5 h-9 pl-3 pr-2 rounded-full bg-white text-[#2B2623] text-sm2 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {activeGoal.emoji && <span className="text-[16px] leading-none">{activeGoal.emoji}</span>}
            <span>{activeGoal.label}</span>
            <X size={16} className="text-[#2B2623]/60" />
          </button>
        )}
        {hint && <p className="mt-2 px-1 text-cap font-semibold text-white/75">{hint}</p>}
      </div>

      <div className="relative flex-1 min-h-0">
      {filteredUsers.length === 0 && !hasIntro ? (
        <div className="h-full flex flex-col items-center justify-center px-6">
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
            <section className="relative h-full w-full snap-start snap-always overflow-y-auto no-scrollbar bg-gradient-to-b from-[#2B2623] to-[#141210] px-4 pt-4 pb-6 flex flex-col gap-4">
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
              tab={tab}
              isFirst={index === 0 && !hasIntro}
              myGoals={myGoals}
              onOpen={() => {
                telegramService.haptic('selection');
                onSelectUser(user);
              }}
              onReact={onReact}
              onUnmatch={onUnmatch ? () => onUnmatch(user) : undefined}
              onOpenWishKind={onOpenWishKind}
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
          topClass="top-3"
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

      </div>

      {isFiltersOpen && (
        <PeopleFiltersSheet
          value={filters}
          onChange={setFilters}
          goal={selectedGoal}
          onGoalChange={onSelectGoal}
          resultCount={applyPeopleFilters(users, filters, myPrefs).filter((u) => matchesGoalFilter(u, selectedGoal)).length}
          onClose={() => setIsFiltersOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * Человек: сверху чистое фото, под ним анкета на сплошном фоне и кнопки 🙈 и 👋 под большим пальцем
 */
const PersonReel: React.FC<{
  user: UserProfile;
  tab: FeedTab;
  isFirst: boolean;
  myGoals?: ActivityGoal[];
  onOpen: () => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<void> | void;
  onSkip: () => void;
  onUnmatch?: () => Promise<void>;
  onOpenWishKind?: (kind: string, sport?: string) => void;
}> = ({ user, tab, isFirst, myGoals, onOpen, onReact, onSkip, onUnmatch, onOpenWishKind }) => {
  const [busy, setBusy] = useState<ReactionType | 'unmatch' | null>(null);
  const [isConfirmingHide, setIsConfirmingHide] = useState(false);
  const [isConfirmingUnmatch, setIsConfirmingUnmatch] = useState(false);
  const common = new Set(commonGoalIds(user, myGoals));
  const goals = goalsOf(user);
  // Карточка на экране полсекунды — посмотрели (лицо замечаешь и при быстром листании): в следующий раз человек будет ниже
  const seenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = seenRef.current;
    if (!el) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) timer = window.setTimeout(() => markPersonSeen(user.telegramId), 500);
        else window.clearTimeout(timer);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [user.telegramId]);
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
  // Статусы человека: на связи, хочет пообщаться, гид, «поныть», «могу сейчас».
  // На своей вкладке «На связи» и «Хочет пообщаться» не повторяем; «Эмпат» — в анкете
  const statuses = [
    user.isMatch && tab !== 'matches' && { text: '🤝 На связи', cls: 'bg-zine-sage text-white' },
    user.likedMe && !user.isMatch && tab !== 'likes' && { text: '👋 Хочет пообщаться', cls: 'bg-white text-[#2B2623]' },
    isAvailableNow(user) && { text: `⚡ Могу сейчас · до ${formatTime(user.availableUntil)}`, cls: 'bg-[#2FA36B] text-white' },
    isVentingNow(user) && { text: `🫂 Хочется поныть · до ${formatTime(user.ventUntil)}`, cls: 'bg-[#C77D86] text-white' },
    user.isGuide && { text: '🧭 Покажу город', cls: 'bg-zine-sky text-white' }
  ].filter(Boolean) as { text: string; cls: string }[];
  const canLike = !user.isMatch && !user.iLiked;

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

  const confirmBox = (text: string, yes: React.ReactNode, onYes: () => void, no: string, onNo: () => void) => (
    <div className="p-3 rounded-zine-sm bg-white/10">
      <p className="text-sm2 mb-2.5">{text}</p>
      <div className="flex gap-2">
        <button onClick={onYes} className="flex-1 h-12 rounded-full bg-zine-danger text-white text-body font-bold flex items-center justify-center cursor-pointer">
          {yes}
        </button>
        <button onClick={onNo} className="flex-1 h-12 rounded-full bg-white text-[#2B2623] text-body font-semibold cursor-pointer">
          {no}
        </button>
      </div>
    </div>
  );

  return (
    <SwipeReel
      className="flex flex-col"
      rightLabel={canLike ? '👋 Привет' : undefined}
      leftLabel={user.isMatch ? undefined : FEED_TEXTS.skipStamp}
      leftBehavior="remove"
      onSwipe={(dir) => {
        if (dir === 'right') react('like');
        // Свайп влево — просто «пропустить»: человек вернётся через несколько дней. Скрыть навсегда — кнопкой 🙈
        else onSkip();
      }}
    >
      {/* Фото — без надписей и кнопок поверх, только точки и стрелки */}
      <div ref={seenRef} className="relative mx-3 flex-1 min-h-[42%] rounded-zine overflow-hidden bg-[#2B2623]">
        <img src={gallery[photoIndex] || user.avatarUrl} alt={user.firstName} draggable={false} onClick={onOpen} onLoad={preloadGallery} className="absolute inset-0 h-full w-full object-cover cursor-pointer" loading="lazy" />
        {/* Несколько фото: тап слева и справа листает, как в сторис; по центру — анкета */}
        {gallery.length > 1 && (
          <>
            <div className="absolute top-2.5 inset-x-0 z-10 flex justify-center gap-1.5 pointer-events-none" aria-hidden>
              {gallery.map((src, i) => (
                <span key={src} className={`w-1.5 h-1.5 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/45'}`} />
              ))}
            </div>
            <button type="button" aria-label={PHOTO_TEXTS.galleryPrev} onClick={() => showPhoto(-1)} className="absolute left-0 inset-y-0 w-[30%] z-10 flex items-center justify-start pl-2 cursor-pointer">
              <span className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white/90 flex items-center justify-center">
                <ChevronLeft size={22} />
              </span>
            </button>
            <button type="button" aria-label={PHOTO_TEXTS.galleryNext} onClick={() => showPhoto(1)} className="absolute right-0 inset-y-0 w-[30%] z-10 flex items-center justify-end pr-2 cursor-pointer">
              <span className="w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm text-white/90 flex items-center justify-center">
                <ChevronRight size={22} />
              </span>
            </button>
          </>
        )}
        {/* Подсказка про жесты — только на первой карточке, внизу фото */}
        {isFirst && (
          <SwipeHint className="bottom-3" left={user.isMatch ? undefined : FEED_TEXTS.skipHint} right={canLike ? '👋' : undefined} extra={gallery.length > 1 ? PHOTO_TEXTS.tapHint : undefined} />
        )}
      </div>

      {/* Анкета на сплошном фоне; нажатие мимо кнопок — открыть целиком */}
      <div
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) onOpen();
        }}
        className="shrink-0 px-4 pt-3 text-white cursor-pointer"
      >
        {/* Статусы — компактной строкой */}
        {statuses.length > 0 && (
          <div data-no-swipe className="mb-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
            {statuses.map((st) => (
              <span key={st.text} className={`h-7 px-2.5 shrink-0 whitespace-nowrap rounded-full text-cap font-bold flex items-center ${st.cls}`}>
                {st.text}
              </span>
            ))}
          </div>
        )}

        <h2 className="flex items-center gap-1 font-serif font-bold text-title leading-tight">
          <span className="truncate">
            {user.firstName}
            {user.age ? <span className="font-sans font-medium text-white/75">, {user.age}</span> : null}
          </span>
          <ChevronRight size={22} className="shrink-0 text-white/60" aria-hidden />
        </h2>
        {/* Только район: расстояние считается от центра района и часто не сходится с жизнью */}
        <p className="mt-0.5 flex items-center gap-1.5 text-sm2 text-white/70">
          <MapPin size={16} className="shrink-0" />
          <span className="truncate">{user.isTourist ? 'В Минске проездом' : user.areaName || 'Минск'}</span>
        </p>
        <div data-no-swipe className="mt-2 -mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar fade-right">
          {/* Общие со мной интересы — первыми, с горчичной обводкой; затем «обычно хожу» и остальное */}
          {goals.filter((g) => common.has(g.id)).map((goal) => (
            <span key={goal.id} className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full border border-zine-mustard bg-zine-mustard/15 text-[#F6D9A8] text-sm2 font-semibold flex items-center gap-1.5">
              {goal.emoji} {goal.label}
            </span>
          ))}
          {user.goesWith && GOES_WITH[user.goesWith] && (
            <span className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/10 text-sm2 font-semibold flex items-center gap-1.5">
              {GOES_WITH[user.goesWith].emoji} {GOES_WITH[user.goesWith].label}
            </span>
          )}
          {goals.filter((g) => !common.has(g.id)).map((goal) => (
            <span key={goal.id} className="h-8 px-3 shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/10 text-sm2 font-semibold flex items-center gap-1.5">
              {goal.emoji} {goal.label}
            </span>
          ))}
        </div>
        {/* Почему показан: общие «Хочу сходить» и сходки */}
        {/* Не влезает в ширину — листается вправо; «Тоже хочет» (всегда последний) открывает, кто ещё хочет */}
        {user.why && user.why.length > 0 && (
          <div data-no-swipe className="mt-2 -mx-4 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar fade-right text-sm2 font-semibold text-zine-mustard whitespace-nowrap">
            {user.why.map((reason, i) => {
              const isWish = i === user.why!.length - 1 && !!user.wishKinds?.length && !!onOpenWishKind;
              return (
                <React.Fragment key={reason}>
                  {i > 0 && <span className="shrink-0 text-zine-mustard/60">·</span>}
                  {isWish ? (
                    <button
                      onClick={() => {
                        telegramService.haptic('selection');
                        onOpenWishKind!(user.wishKinds![0].kind, user.wishKinds![0].sport);
                      }}
                      className="shrink-0 flex items-center gap-1 underline underline-offset-4 decoration-zine-mustard/60 cursor-pointer"
                    >
                      {reason}
                      <ChevronRight size={16} className="shrink-0" />
                    </button>
                  ) : (
                    <span className="shrink-0">{reason}</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
        {user.bio && <p className="mt-2 text-sm2 text-white/80 line-clamp-2">{user.bio}</p>}
        {user.isMatch && !user.username && <p className="mt-2 text-cap text-white/60">🤝 У человека нет @username, ссылку прислал бот в чате.</p>}
      </div>

      {/* Кнопки под большим пальцем; подтверждения — на их месте */}
      <div className="shrink-0 px-4 pt-3 pb-3 text-white">
        {isConfirmingUnmatch ? (
          confirmBox(FEED_TEXTS.unmatchConfirm, busy === 'unmatch' ? <Loader2 size={20} className="animate-spin" /> : FEED_TEXTS.unmatchYes, unmatch, FEED_TEXTS.unmatchNo, () => setIsConfirmingUnmatch(false))
        ) : isConfirmingHide ? (
          confirmBox('🙈 Скрыть навсегда? Вы больше не увидите друг друга.', busy ? <Loader2 size={20} className="animate-spin" /> : 'Да, скрыть', () => react('dislike'), 'Нет', () => setIsConfirmingHide(false))
        ) : user.isMatch ? (
          <div className="flex gap-2">
            {onUnmatch && (
              <button
                onClick={() => {
                  telegramService.haptic('warning');
                  setIsConfirmingUnmatch(true);
                }}
                className="flex-1 h-12 rounded-full border border-white/25 text-body font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Undo2 size={20} />
                {FEED_TEXTS.unmatch}
              </button>
            )}
            {user.username && (
              <button
                onClick={() => {
                  telegramService.haptic('medium');
                  telegramService.openChat(user.username);
                }}
                className="flex-[1.6] h-12 rounded-full bg-zine-terracotta text-body font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={20} />
                Написать
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => react('dislike')} className="flex-1 h-12 rounded-full border border-white/25 text-body font-semibold flex items-center justify-center gap-2 cursor-pointer">
              <span className="text-[20px] leading-none">🙈</span>
              Скрыть
            </button>
            <button
              onClick={() => react('like')}
              disabled={user.iLiked}
              className={`flex-[1.6] h-12 rounded-full text-body font-bold flex items-center justify-center gap-2 cursor-pointer ${user.iLiked ? 'bg-zine-sage' : 'bg-zine-terracotta'}`}
            >
              {busy === 'like' ? <Loader2 size={20} className="animate-spin" /> : <span className="text-[20px] leading-none">👋</span>}
              {user.iLiked ? 'Привет отправлен' : 'Пообщаться'}
            </button>
          </div>
        )}
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
