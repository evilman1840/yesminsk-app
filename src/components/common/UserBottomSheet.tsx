import { LiveStatusText, useLiveStatus } from './LiveStatus';
import { useAnalyticsView } from '../../analytics/hooks';
import { QuestionnaireSummary } from '../../profile/QuestionnaireSummary';
import { MeetupExperience } from './MeetupExperience';
import React, { useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { UserProfile, ActivityGoal, goalsOf, commonGoalIds, GOES_WITH, EMPATH, isVentingNow, isAvailableNow, formatTime } from '../../types';
import { ReactionButtons, ChatButton, ReactionType } from './Reactions';
import { BottomSheet } from '../ui/BottomSheet';
import { ReportSheet, SafetyTipsSheet } from './ReportSheet';
import { photoSrc } from './PhotoPicker';
import { telegramService } from '../../services/telegram';
import { BUDDY_TEXTS } from '../../texts/buddies';
import { HELLO_TEXTS, DUEL_TEXTS } from '../../texts/hello';

interface UserBottomSheetProps {
  user: UserProfile;
  myGoals?: ActivityGoal[]; // чтобы подсветить общие интересы
  onClose: () => void;
  onReact: (user: UserProfile, type: ReactionType) => Promise<unknown> | void;
  onReported: (user: UserProfile) => void;
  // «На связи»: те же поводы заговорить, что и на карточке в «Людях». Шторку закрываем, открывается следующая
  onGoTogether?: (user: UserProfile) => void;
  onHello?: (user: UserProfile) => void;
  onDuel?: (user: UserProfile) => void;
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
export const UserBottomSheet: React.FC<UserBottomSheetProps> = ({ user, myGoals, onClose, onReact, onReported, onGoTogether, onHello, onDuel }) => {
  useAnalyticsView('gulyai_person_opened', user.telegramId);
  const liveStatus = useLiveStatus(user.liveStatus);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTipsOpen, setIsTipsOpen] = useState(false);

  const common = new Set(commonGoalIds(user, myGoals));
  // Общие интересы — первыми
  const goals = goalsOf(user).sort((a, b) => Number(common.has(b.id)) - Number(common.has(a.id)));
  const commonGoals = goals.filter((g) => common.has(g.id));
  const distance = formatDistance(user.distanceMeters);
  const gallery = [user.avatarUrl, ...(user.photos || []).map(photoSrc)];
  const [photoIndex, setPhotoIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  // Тап по краю фото листает, как в сторис: слева — назад, справа — вперёд (по кругу)
  const onGalleryTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = galleryRef.current;
    if (!el || gallery.length < 2) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const step = x < 0.35 ? -1 : x > 0.65 ? 1 : 0;
    if (!step) return;
    telegramService.haptic('selection');
    const next = (photoIndex + step + gallery.length) % gallery.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };
  const goesWith = user.goesWith && GOES_WITH[user.goesWith];

  const then = (action?: (u: UserProfile) => void) =>
    action &&
    (() => {
      telegramService.haptic('selection');
      onClose();
      action(user);
    });
  const goTogether = then(onGoTogether);
  const hello = then(onHello);
  const duel = then(onDuel);
  // Как на карточке «На связи»: сходка вместе, «Что написать» и «Сыграть», под ними «Написать»
  const matchButtons = (
    <div>
      {goTogether && (
        <button
          onClick={goTogether}
          className="mb-2 w-full h-12 rounded-full border-2 border-zine-terracotta text-zine-terracotta text-body font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
        >
          {BUDDY_TEXTS.goTogether}
        </button>
      )}
      {(hello || duel) && (
        <div className="mb-2 flex gap-2">
          {hello && (
            <button onClick={hello} className="flex-1 h-11 rounded-full bg-zine-mustard/20 text-zine-ink text-sm2 font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform">
              {HELLO_TEXTS.btn}
            </button>
          )}
          {duel && (
            <button onClick={duel} className="flex-1 h-11 rounded-full bg-zine-mustard/20 text-zine-ink text-sm2 font-bold flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform">
              {DUEL_TEXTS.btn}
            </button>
          )}
        </div>
      )}
      <ChatButton user={user} className="w-full" />
    </div>
  );

  return (
    <BottomSheet
      onClose={onClose}
      footer={user.isMatch ? matchButtons : <ReactionButtons user={user} onReact={onReact} />}
    >
      {photoOpen && <BottomSheet title="Фото" onClose={() => setPhotoOpen(false)}><img src={gallery[photoIndex] || user.avatarUrl} alt={user.firstName} className="w-full max-h-[70vh] object-contain rounded-zine bg-zine-card" />{gallery.length > 1 && <div className="flex gap-3 mt-3"><button type="button" onClick={() => setPhotoIndex(i => (i-1+gallery.length)%gallery.length)} className="flex-1 min-h-11 rounded-zine-sm bg-zine-card">Предыдущее</button><button type="button" onClick={() => setPhotoIndex(i => (i+1)%gallery.length)} className="flex-1 min-h-11 rounded-zine-sm bg-zine-card">Следующее</button></div>}</BottomSheet>}
      {/* Фото с именем поверх */}
      <div className="relative -mt-1 rounded-zine overflow-hidden bg-zine-card">
        {/* Главное фото и ещё до 5: листаются пальцем и тапом по краям */}
        <div
          ref={galleryRef}
          onClick={onGalleryTap}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => setPhotoIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {/* Без loading="lazy": в горизонтальной ленте «ленивые» фото начинают грузиться, только когда до них долистали */}
          {gallery.map((src) => (
            <img key={src} src={src} alt={user.firstName} className="w-full shrink-0 snap-center aspect-[4/5] max-h-[52vh] object-cover object-[center_35%]" />
          ))}
        </div>
        {gallery.length > 1 && (
          <div className="absolute top-2 inset-x-3 flex gap-1 pointer-events-none" aria-hidden>
            {gallery.map((src, i) => (
              <span key={src} className={`h-1 flex-1 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/45'}`} />
            ))}
          </div>
        )}
        <div className="absolute top-4 left-3 right-3 flex items-start justify-between gap-2">
          <div className="pointer-events-none">{isAvailableNow(user) ? <span className="inline-block px-3 py-1 rounded-full bg-zine-sage text-white text-sm2 font-bold">⚡ Могу сейчас</span> : user.isMatch ? <span className="inline-block px-3 py-1 rounded-full bg-zine-sage text-white text-sm2 font-bold">🤝 На связи</span> : user.likedMe ? <span className="inline-block px-3 py-1 rounded-full bg-zine-ink text-zine-paper text-sm2 font-bold">👋 Хочет пообщаться</span> : null}</div>
          <button type="button" onClick={() => setPhotoOpen(true)} aria-label="Рассмотреть фото без подписей" className="w-11 h-11 shrink-0 rounded-full bg-black/40 text-white text-title">↗</button>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pt-16 pb-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white pointer-events-none">
          <h3 className="font-serif font-bold text-display leading-tight">
            {user.firstName}
            {user.age ? <span className="font-sans font-medium text-white/85">, {user.age}</span> : null}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm2 text-white/85">
            <MapPin size={16} className="shrink-0" />
            <span className="truncate">
              {user.isTourist ? 'В Минске проездом' : user.areaName || 'Минск'}
              {distance && ` · ${distance}`}
            </span>
          </p>
          <MeetupExperience user={user} className="mt-2" />
        </div>
      </div>

      {liveStatus && <div className="mt-3"><LiveStatusText status={liveStatus} /></div>}

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

      {(user.isGuide || user.isEmpath || user.activeRecently) && <div className="mt-3 flex flex-wrap items-center gap-2">
        {user.isGuide && <span className="text-sm2 rounded-full bg-zine-card px-3 py-2">🧭 Покажу город</span>}
        {user.isEmpath && <span className="text-sm2 rounded-full bg-zine-card px-3 py-2">🫶 Эмпат</span>}
        {user.activeRecently && <span className="w-full text-cap text-zine-inkMuted">Недавно в приложении</span>}
      </div>}

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

      {goesWith && <p className="mt-4 text-body">{goesWith.emoji} Обычно хожу: <b>{goesWith.label.toLowerCase()}</b></p>}
      <QuestionnaireSummary value={user.questionnaire} fallbackActivities={goals} />

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
