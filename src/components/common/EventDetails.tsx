import React, { useState } from 'react';
import { thumb } from '../../utils/thumb';
import { Check, Clock, MapPin, Users, Send, Share2, Navigation, Loader2 } from 'lucide-react';
import { AppEvent, JoinOptions, eventCategoryOf, EVENT_TAGS, companyNote, SUPPORT_RULES } from '../../types';
import { HelpLine } from './HelpLine';
import { telegramService } from '../../services/telegram';
import { formatEventDate } from '../../screens/MapScreen';
import { ReportSheet } from './ReportSheet';
import { JoinSheet } from './JoinSheet';
import { MEETUP_TEXTS, priceLabel } from '../../texts/meetups';
import { photoSrc } from './PhotoPicker';
import { useOpenUser } from '../../context/openUser';
import { useIsAdmin, EVENT_DELETED } from '../../context/admin';
import { confirmAttendance } from '../../context/eventUpdates';
import { EVENT_MESSAGE_TEXTS as EM } from '../../texts/eventMessage';
import { api } from '../../services/api';
import { BottomSheet } from '../ui/BottomSheet';

/**
 * Подробности сходки: когда, где, сколько идёт, кнопки «Пойду!», «Позвать друзей» и «Организатору»
 */
// Строка «Идут: 7 из 10 · 3 компании · 👶 2»
export const eventPeopleLine = (ev: AppEvent) => {
  const groups = ev.groupsCount ?? ev.participantsCount;
  return [
    `Идут: ${ev.participantsCount || 1}${ev.maxParticipants ? ` из ${ev.maxParticipants}` : ''}`,
    groups && groups < ev.participantsCount ? `${groups} ${groups === 1 ? 'компания' : groups < 5 ? 'компании' : 'компаний'}` : '',
    ev.withKidsCount ? `👶 ${ev.withKidsCount}` : ''
  ]
    .filter(Boolean)
    .join(' · ');
};

// 1 место, 2 места, 5 мест
export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
};

// «сегодня», «завтра», «через 3 дня» — по календарным дням
export const relativeDay = (iso: string) => {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(new Date(iso)) - day(new Date())) / 86400000);
  if (diff < 0) return 'уже прошла';
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  return `через ${diff} ${plural(diff, 'день', 'дня', 'дней')}`;
};

const Avatar: React.FC<{ src?: string; name: string; size?: string }> = ({ src, name, size = 'w-12 h-12' }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover bg-zine-card shrink-0`} loading="lazy" />
  ) : (
    <span className={`${size} rounded-full bg-zine-card text-zine-inkMuted font-bold flex items-center justify-center shrink-0`}>{name.slice(0, 1)}</span>
  );

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="mb-2 text-cap font-bold uppercase tracking-wide text-zine-inkMuted">{children}</h4>
);

export const EventDetails: React.FC<{
  event: AppEvent;
  // options — с кем идёшь; null — «Не пойду»
  onJoin: (options: JoinOptions | null) => Promise<unknown> | void;
  onReported?: () => void;
}> = ({ event: eventProp, onJoin, onReported }) => {
  // «Точно приду» нажали здесь: шторка на карте держит свою копию сходки, поэтому ответ сервера подмешиваем сами
  const [confirmedNow, setConfirmedNow] = useState<AppEvent | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const event = confirmedNow && confirmedNow.id === eventProp.id && eventProp.isJoined ? { ...eventProp, ...confirmedNow } : eventProp;
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const cat = eventCategoryOf(event);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const openUser = useOpenUser();
  const isAdmin = useIsAdmin();
  const [isAdminDeleteOpen, setIsAdminDeleteOpen] = useState(false);
  const isCreator = Number(event.creator?.telegramId) === Number(telegramService.getUser()?.id);
  const isFull = !event.isJoined && Boolean(event.maxParticipants) && (event.participantsCount || 1) >= event.maxParticipants;

  const [lat, lng] = event.coordinates || [0, 0];
  const routeUrl = `https://yandex.by/maps/?rtext=~${lat},${lng}&rtt=pd`;
  const myNote = companyNote(event.myGuests, event.myWithKids);
  const taken = event.participantsCount || 1;
  const left = event.maxParticipants ? Math.max(0, event.maxParticipants - taken) : null;
  // Кто идёт, кроме организатора (сервер присылает всех)
  const others = (event.participants || []).filter((p) => Number(p.telegramId) !== Number(event.creator?.telegramId));
  const moreGroups = Math.max(0, (event.groupsCount ?? event.participantsCount) - 1 - others.length);

  return (
    <div>
      {/* Фото сходки листаются пальцем */}
      {event.photos && event.photos.length > 0 && (
        <div className="-mx-5 mb-4 px-5 flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-5">
          {event.photos.map((url) => (
            <img
              key={url}
              src={photoSrc(url)}
              alt=""
              className={`${event.photos!.length > 1 ? 'w-[85%]' : 'w-full'} shrink-0 snap-start aspect-[4/3] object-cover rounded-zine bg-zine-card`}
              loading="lazy"
            />
          ))}
        </div>
      )}

      {event.isOfficial && <p className="text-sm2 font-bold text-zine-terracotta">⭐ Тут рады новичкам</p>}

      {/* Категория и пометки */}
      <div className={`${event.isOfficial ? 'mt-2' : ''} flex flex-wrap gap-1.5`}>
        {cat && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold ${cat.badgeBg} ${cat.badgeText}`}>
            {cat.emoji} {cat.label}
          </span>
        )}
        {(event.tags || []).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm2 font-semibold bg-zine-card text-zine-ink">
            {EVENT_TAGS[t].emoji} {EVENT_TAGS[t].label}
          </span>
        ))}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm2 font-semibold bg-zine-card text-zine-ink">{priceLabel(event)}</span>
        {(event.badges || []).map((b) => (
          <span key={b} className="inline-flex items-center px-3 py-1 rounded-full text-sm2 font-semibold bg-zine-card text-zine-ink">
            {b}
          </span>
        ))}
      </div>

      {/* Когда, где, кто идёт — одним списком */}
      <div className="mt-4 rounded-zine border border-zine-border divide-y divide-zine-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Clock size={19} className="shrink-0 text-zine-terracotta" />
          <span className="text-body text-zine-ink">
            <b>{formatEventDate(event.dateTime)}</b>
            <span className="text-zine-inkMuted"> · {relativeDay(event.dateTime)}</span>
            {event.durationMinutes ? <span className="text-zine-inkMuted"> · {MEETUP_TEXTS.duration(event.durationMinutes)}</span> : null}
          </span>
        </div>
        <button onClick={() => lat && telegramService.openLink(routeUrl)} className="w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer">
          <MapPin size={19} className="shrink-0 text-zine-terracotta" />
          <span className="min-w-0 text-body text-zine-ink underline decoration-zine-border underline-offset-4">{event.locationName}</span>
        </button>
      </div>

      {event.description && (
        <section className="mt-5">
          <SectionTitle>О сходке</SectionTitle>
          <p className="text-body text-zine-ink whitespace-pre-line">{event.description}</p>
        </section>
      )}

      {/* Кто идёт: организатор, участники и свободные места */}
      <section className="mt-5">
        <SectionTitle>Кто идёт</SectionTitle>
        <div className="flex items-center gap-3">
          {/* Нажать на организатора — его анкета */}
          <button
            type="button"
            disabled={isCreator}
            onClick={() => openUser(Number(event.creator.telegramId))}
            className="min-w-0 flex-1 flex items-center gap-3 text-left cursor-pointer disabled:cursor-default"
          >
            <Avatar src={thumb(event.creator?.avatarUrl)} name={event.creator?.name || '?'} />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-zine-ink truncate">{isCreator ? 'Ты' : event.creator?.name}</span>
              <span className="block text-sm2 text-zine-inkMuted">собирает сходку</span>
            </span>
          </button>
          {event.creator?.username && !isCreator && (
            <button
              onClick={() => {
                telegramService.haptic('medium');
                telegramService.openChat(event.creator.username);
              }}
              className="h-10 px-4 shrink-0 rounded-full bg-zine-card text-zine-ink text-sm2 font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <Send size={16} /> Написать
            </button>
          )}
        </div>

        {/* Организатору — список с Telegram участников и «Написать участникам» */}
        {isCreator && others.length > 0 && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setIsMessageOpen(true)}
              className="w-full h-12 rounded-zine-sm bg-zine-ink text-zine-paper text-body font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
            >
              {EM.button(others.length)}
            </button>
            {others.map((p) => (
              <div key={p.telegramId} className="flex items-center gap-3">
                <button type="button" onClick={() => openUser(p.telegramId)} className="min-w-0 flex-1 flex items-center gap-3 text-left cursor-pointer">
                  <Avatar src={thumb(p.avatarUrl)} name={p.name} size="w-10 h-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-zine-ink truncate">
                      {p.name}
                      {p.guests ? ` +${p.guests}` : ''}
                      {p.withKids ? ' 👶' : ''}
                    </span>
                    <span className="block text-cap text-zine-inkMuted truncate">
                      {p.confirmed && <span className="font-semibold text-zine-sage">✅ {MEETUP_TEXTS.confirmedOne} · </span>}
                      {p.username ? `@${p.username}` : EM.noUsername}
                    </span>
                  </span>
                </button>
                {p.username && (
                  <button
                    type="button"
                    aria-label={EM.writeOne}
                    onClick={() => {
                      telegramService.haptic('medium');
                      telegramService.openChat(p.username);
                    }}
                    className="w-10 h-10 shrink-0 rounded-full bg-zine-card text-zine-ink flex items-center justify-center cursor-pointer"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isCreator && others.length > 0 && (
          <div className="mt-3 -mx-5 px-5 flex gap-3 overflow-x-auto no-scrollbar">
            {others.map((p) => (
              <button type="button" key={p.telegramId} onClick={() => openUser(p.telegramId)} className="w-14 shrink-0 flex flex-col items-center gap-1 cursor-pointer">
                <div className="relative">
                  <Avatar src={thumb(p.avatarUrl)} name={p.name} size="w-12 h-12" />
                  {p.confirmed && (
                    <span aria-label={MEETUP_TEXTS.confirmedBadge} title={MEETUP_TEXTS.confirmedBadge} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zine-sage text-white flex items-center justify-center shadow">
                      <Check size={12} strokeWidth={3.5} />
                    </span>
                  )}
                  {(p.guests || p.withKids) && (
                    <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-zine-cardElevated text-[11px] font-bold text-zine-ink shadow">
                      {p.withKids ? '👶' : ''}
                      {p.guests ? `+${p.guests}` : ''}
                    </span>
                  )}
                </div>
                <span className="w-full text-center text-cap text-zine-ink truncate">{p.name}</span>
              </button>
            ))}
            {moreGroups > 0 && (
              <div className="w-14 shrink-0 flex flex-col items-center gap-1">
                <span className="w-12 h-12 rounded-full bg-zine-card text-zine-inkMuted text-sm2 font-bold flex items-center justify-center">+{moreGroups}</span>
                <span className="text-cap text-zine-inkMuted">ещё</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-sm2 text-zine-inkMuted">
          <Users size={17} className="shrink-0 text-zine-terracotta" />
          <span>{eventPeopleLine(event)}</span>
        </div>
        {event.maxParticipants ? (
          <div className="mt-2">
            <div className="h-2 rounded-full bg-zine-card overflow-hidden">
              <div className="h-full rounded-full bg-zine-terracotta" style={{ width: `${Math.min(100, (taken / event.maxParticipants) * 100)}%` }} />
            </div>
            <p className={`mt-1 text-cap font-semibold ${left ? 'text-zine-inkMuted' : 'text-zine-danger'}`}>
              {left ? `Свободно ${left} ${plural(left, 'место', 'места', 'мест')}` : 'Мест больше нет'}
            </p>
          </div>
        ) : null}
      </section>

      {/* «Поныть» — правила встречи и куда обращаться, если совсем тяжело */}
      {event.category === 'support' && (
        <div className="mt-4 p-4 rounded-zine bg-zine-blush/15">
          <p className="text-body font-bold text-zine-ink">🫂 Правила встречи</p>
          <ul className="mt-1.5 space-y-1">
            {SUPPORT_RULES.map((r) => (
              <li key={r} className="text-sm2 text-zine-ink">
                • {r}
              </li>
            ))}
          </ul>
          <HelpLine className="mt-3" />
        </div>
      )}
      {(event.tags || []).includes('empaths') && (
        <p className="mt-3 text-sm2 text-zine-inkMuted">🫶 Записаться могут только те, кто отметил «Эмпат» в анкете.</p>
      )}

      {/* Позвать и маршрут */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <SmallAction
          onClick={() => {
            telegramService.haptic('selection');
            telegramService.shareEvent(event);
          }}
          icon={<Share2 size={20} />}
          label="Позвать друзей"
        />
        <SmallAction onClick={() => telegramService.openLink(routeUrl)} icon={<Navigation size={20} />} label="Маршрут" />
      </div>

      {!isCreator && (
        <button onClick={() => setIsReportOpen(true)} className="mt-3 w-full h-10 text-sm2 text-zine-inkMuted cursor-pointer">
          Пожаловаться на сходку
        </button>
      )}
      {isAdmin && !isCreator && (
        <button onClick={() => setIsAdminDeleteOpen(true)} className="w-full h-10 text-sm2 font-semibold text-zine-danger cursor-pointer">
          {MEETUP_TEXTS.adminDelete}
        </button>
      )}
      {/* Заходит и на нижний отступ шторки — чтобы под кнопкой не просвечивал текст */}
      <div
        className="sticky z-10 -mx-5 -mb-4 mt-3 px-5 pt-3 bg-zine-cardElevated border-t border-zine-border"
        style={{ bottom: 'calc(-1 * max(8px, env(safe-area-inset-bottom)))', paddingBottom: 'calc(12px + max(8px, env(safe-area-inset-bottom)))' }}
      >
        {/* Главное действие — закреплено внизу шторки */}
        <button
          onClick={() => {
            telegramService.haptic('medium');
            setIsJoinOpen(true);
          }}
          disabled={isFull || isCreator}
          className={`w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer ${
            isCreator
              ? 'bg-zine-card text-zine-inkMuted cursor-default'
              : event.isJoined
              ? 'bg-zine-sage/15 text-zine-sage'
              : isFull
              ? 'bg-zine-card text-zine-inkMuted cursor-default'
              : 'bg-zine-terracotta text-white'
          }`}
        >
          {isCreator ? (
            <span>Ты собираешь эту сходку</span>
          ) : isFull ? (
            <span>Мест нет: все {event.maxParticipants} заняты</span>
          ) : event.isJoined ? (
            <>
              <Check size={22} strokeWidth={3} />
              <span>Я иду{myNote ? ` (${myNote})` : ''} · изменить</span>
            </>
          ) : (
            <span>Пойду!</span>
          )}
        </button>
        {event.isJoined && !isCreator && (
          <div className="mt-2 flex items-center justify-between gap-3">
            {event.myConfirmed ? (
              <span className="min-w-0 text-sm2 text-zine-inkMuted">{MEETUP_TEXTS.confirmedMine}</span>
            ) : (
              <button
                onClick={async () => {
                  setIsConfirming(true);
                  const updated = await confirmAttendance(event);
                  if (updated) setConfirmedNow(updated);
                  setIsConfirming(false);
                }}
                disabled={isConfirming}
                className="h-10 px-4 rounded-full bg-zine-sage text-white text-body font-bold flex items-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
              >
                {isConfirming ? <Loader2 size={18} className="animate-spin" /> : MEETUP_TEXTS.confirmGo}
              </button>
            )}
            <button
              onClick={async () => {
                if (!(await telegramService.confirm(MEETUP_TEXTS.notGoingConfirm(event.title), { okText: MEETUP_TEXTS.notGoingOk, destructive: true }))) return;
                await onJoin(null);
              }}
              className="h-10 px-1 shrink-0 text-body font-bold text-zine-danger underline underline-offset-4 cursor-pointer"
            >
              {MEETUP_TEXTS.notGoing}
            </button>
          </div>
        )}
      </div>

      {isAdminDeleteOpen && (
        <AdminDeleteSheet
          event={event}
          onClose={() => setIsAdminDeleteOpen(false)}
          onDeleted={() => {
            window.dispatchEvent(new CustomEvent<string>(EVENT_DELETED, { detail: String(event.id) }));
            onReported?.();
          }}
        />
      )}
      {isMessageOpen && <MessageParticipantsSheet eventId={String(event.id)} onClose={() => setIsMessageOpen(false)} />}

      {isJoinOpen && (
        <JoinSheet event={event} onConfirm={async (o) => onJoin(o)} onLeave={async () => onJoin(null)} onClose={() => setIsJoinOpen(false)} />
      )}
      {isReportOpen && (
        <ReportSheet
          targetType="event"
          targetId={event.id}
          targetName={event.title}
          onClose={() => setIsReportOpen(false)}
          onReported={() => onReported?.()}
        />
      )}
    </div>
  );
};

const SmallAction: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="h-[64px] rounded-zine-sm bg-zine-card text-zine-ink text-sm2 font-semibold flex flex-col items-center justify-center gap-1 active:scale-[0.97] transition-transform cursor-pointer"
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Организатор пишет участникам: бот перешлёт всем, кто записан
// Модератор удаляет чужую сходку и пишет организатору, почему
const AdminDeleteSheet: React.FC<{ event: AppEvent; onClose: () => void; onDeleted: () => void }> = ({ event, onClose, onDeleted }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <BottomSheet title={MEETUP_TEXTS.adminDeleteTitle} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{MEETUP_TEXTS.adminDeleteHint(event.title)}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 800))} rows={4} placeholder={MEETUP_TEXTS.adminDeletePlaceholder} className="field mt-4" autoFocus />
      {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
      <button
        disabled={!text.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.adminDeleteEvent(String(event.id), text.trim());
            telegramService.haptic('success');
            onClose();
            onDeleted();
          } catch (err: any) {
            setError(err?.message || MEETUP_TEXTS.adminDeleteFailed);
          } finally {
            setBusy(false);
          }
        }}
        className={`mt-4 w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center cursor-pointer ${
          text.trim() ? 'bg-zine-danger text-white' : 'bg-zine-card text-zine-inkMuted cursor-default'
        }`}
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : MEETUP_TEXTS.adminDeleteSend}
      </button>
    </BottomSheet>
  );
};

const MessageParticipantsSheet: React.FC<{ eventId: string; onClose: () => void }> = ({ eventId, onClose }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <BottomSheet title={EM.title} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{EM.hint}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 800))} rows={4} placeholder={EM.placeholder} className="field mt-4" autoFocus />
      {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
      {result && <p className="mt-2 text-sm2 font-semibold text-zine-sage">{result}</p>}
      <button
        disabled={!text.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await api.messageEventParticipants(eventId, text.trim());
            telegramService.haptic('success');
            setResult(EM.sent(res.sent));
            setText('');
            window.setTimeout(onClose, 1500);
          } catch (err: any) {
            setError(err?.message || EM.failed);
          } finally {
            setBusy(false);
          }
        }}
        className={`mt-4 w-full h-14 rounded-zine-sm text-lead font-bold flex items-center justify-center cursor-pointer ${
          text.trim() ? 'bg-zine-terracotta text-white' : 'bg-zine-card text-zine-inkMuted cursor-default'
        }`}
      >
        {busy ? <Loader2 size={22} className="animate-spin" /> : EM.send}
      </button>
    </BottomSheet>
  );
};
