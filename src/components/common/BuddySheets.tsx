import React, { useEffect, useState } from 'react';
import { Loader2, Search, ChevronRight } from 'lucide-react';
import { AppEvent, eventCategoryOf, WishWindow } from '../../types';
import { api, BuddyOptions, BuddyPerson, EventBuddies } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';
import { thumb } from '../../utils/thumb';
import { formatEventDate } from '../../screens/MapScreen';
import { EVENT_UPDATED } from '../../context/eventUpdates';
import { BUDDY_TEXTS as T } from '../../texts/buddies';

/**
 * «👯 Пойдём на сходку вместе»: позвать знакомого из «На связи» на сходку компанией (не вдвоём).
 * GoTogetherSheet — из «На связи»: выбрать сходку. BringBuddySheet — из карточки сходки: выбрать человека
 */

const Avatar: React.FC<{ src?: string; name: string }> = ({ src, name }) =>
  src ? (
    <img src={thumb(src)} alt={name} className="w-11 h-11 rounded-full object-cover bg-zine-card shrink-0" loading="lazy" />
  ) : (
    <span className="w-11 h-11 rounded-full bg-zine-card text-zine-inkMuted font-bold flex items-center justify-center shrink-0">{name.slice(0, 1)}</span>
  );

const LeftNote: React.FC<{ left: number; limit: number }> = ({ left, limit }) => (
  <p className={`text-cap font-semibold ${left > 0 ? 'text-zine-inkMuted' : 'text-zine-danger'}`}>{T.left(left, limit)}</p>
);

// Сервер вернул обновлённую сходку (отправителя могли записать) — обновляем её в списках
const applyEvent = (ev?: AppEvent) => {
  if (ev?.id) window.dispatchEvent(new CustomEvent<AppEvent>(EVENT_UPDATED, { detail: ev }));
};

const sentAlert = (name: string, wasJoined: boolean, res: { delivered: boolean; warning?: string }) =>
  telegramService.alert(res.delivered ? (wasJoined ? T.sent(name) : T.sentAndJoined(name)) : res.warning || T.sendFailed);

/* ---------- Из «На связи»: куда позвать ---------- */

export const GoTogetherSheet: React.FC<{
  friend: { telegramId: number; firstName: string; avatarUrl?: string };
  onClose: () => void;
  // «Собери свою сходку» или общее желание: форма сходки, бот позовёт после публикации
  onCreate: (opts: { template?: string; when?: WishWindow; opt?: string }) => void;
}> = ({ friend, onClose, onCreate }) => {
  const [data, setData] = useState<BuddyOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBuddyOptions(friend.telegramId)
      .then(setData)
      .catch((e: any) => setError(e?.message || T.loadFailed));
  }, [friend.telegramId]);

  const invite = async (ev: AppEvent) => {
    if (sending || !data || data.left <= 0) return;
    telegramService.haptic('medium');
    setSending(ev.id);
    try {
      const res = await api.sendBuddyInvite(ev.id, friend.telegramId, 'people');
      applyEvent(res.event);
      telegramService.haptic(res.delivered ? 'success' : 'warning');
      onClose();
      sentAlert(friend.firstName, ev.isJoined, res);
    } catch (e: any) {
      telegramService.alert(e?.message || T.sendFailed);
    } finally {
      setSending(null);
    }
  };

  const outOfInvites = Boolean(data && data.left <= 0);

  return (
    <BottomSheet title={T.pickTitle} onClose={onClose}>
      <div className="flex items-center gap-3">
        <Avatar src={friend.avatarUrl} name={friend.firstName} />
        <div className="min-w-0">
          <p className="text-lead font-bold text-zine-ink truncate">{friend.firstName}</p>
          <p className="text-sm2 text-zine-inkMuted">{T.pickHint}</p>
        </div>
      </div>

      {!data && !error && (
        <div className="py-10 flex justify-center text-zine-inkMuted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
      {error && <p className="mt-4 p-3 rounded-zine-sm bg-zine-danger/10 text-zine-danger text-sm2 font-semibold">{error}</p>}

      {data && (
        <>
          <div className="mt-3">
            <LeftNote left={data.left} limit={data.limit} />
          </div>

          {data.events.length > 0 ? (
            <div className="mt-3 space-y-2">
              {data.events.map((ev) => {
                const cat = eventCategoryOf(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    disabled={outOfInvites || Boolean(sending)}
                    onClick={() => invite(ev)}
                    className={`w-full p-3 rounded-zine-sm bg-zine-card text-left flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform ${outOfInvites ? 'opacity-50' : ''}`}
                  >
                    <span className="w-11 h-11 rounded-full bg-zine-cardElevated text-[22px] flex items-center justify-center shrink-0">{cat.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-bold text-zine-ink truncate">{ev.title}</span>
                      <span className="block text-cap text-zine-inkMuted truncate">
                        {formatEventDate(ev.dateTime)} · {ev.locationName}
                      </span>
                      <span className="block text-cap text-zine-inkMuted truncate">
                        👥 {ev.participantsCount || 1}
                        {ev.maxParticipants ? ` из ${ev.maxParticipants}` : ''}
                        {ev.isJoined ? ' · ты идёшь' : ''}
                        {ev.bothLike ? <span className="font-semibold text-zine-mustardInk"> · {T.bothLike}</span> : null}
                      </span>
                    </span>
                    {sending === ev.id ? <Loader2 size={20} className="shrink-0 animate-spin text-zine-inkMuted" /> : <ChevronRight size={20} className="shrink-0 text-zine-inkMuted" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 p-3 rounded-zine-sm bg-zine-card text-sm2 text-zine-ink">{T.noEvents}</p>
          )}

          {data.wishes.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-cap font-bold uppercase tracking-wide text-zine-inkMuted">🙋 {T.wishesTitle}</h4>
              <div className="space-y-2">
                {data.wishes.map((w) => (
                  <button
                    key={`${w.kind}:${w.sport || ''}`}
                    type="button"
                    onClick={() => {
                      telegramService.haptic('selection');
                      onCreate({ template: w.kind, when: w.timeWindow, opt: w.sport || undefined });
                    }}
                    className="w-full p-3 rounded-zine-sm border border-zine-mustard bg-zine-mustard/10 text-left flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-bold text-zine-ink truncate">
                        {w.what}, {w.when}
                      </span>
                      <span className="block text-cap text-zine-inkMuted">{T.wishHint}</span>
                    </span>
                    <ChevronRight size={20} className="shrink-0 text-zine-inkMuted" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              telegramService.haptic('selection');
              onCreate({});
            }}
            className="mt-5 w-full h-14 rounded-zine-sm bg-zine-ink text-zine-paper flex flex-col items-center justify-center cursor-pointer active:scale-[0.99] transition-transform"
          >
            <span className="text-body font-bold">{T.createOwn}</span>
            <span className="text-cap opacity-80">{T.createOwnHint}</span>
          </button>
        </>
      )}
    </BottomSheet>
  );
};

/* ---------- Из карточки сходки: кого позвать ---------- */

export const BringBuddySheet: React.FC<{ event: AppEvent; onClose: () => void }> = ({ event, onClose }) => {
  const [data, setData] = useState<EventBuddies | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState<number | null>(null);

  useEffect(() => {
    api
      .getEventBuddies(String(event.id))
      .then(setData)
      .catch((e: any) => setError(e?.message || T.loadFailed));
  }, [event.id]);

  const invite = async (p: BuddyPerson) => {
    if (sending || !data || data.left <= 0 || p.invited) return;
    telegramService.haptic('medium');
    setSending(p.telegramId);
    try {
      const res = await api.sendBuddyInvite(String(event.id), p.telegramId, 'event');
      applyEvent(res.event);
      telegramService.haptic(res.delivered ? 'success' : 'warning');
      setData((d) => (d ? { ...d, left: res.left, people: d.people.map((x) => (x.telegramId === p.telegramId ? { ...x, invited: res.delivered ? 'pending' : 'undelivered' } : x)) } : d));
      sentAlert(p.firstName, event.isJoined, res);
    } catch (e: any) {
      telegramService.alert(e?.message || T.sendFailed);
    } finally {
      setSending(null);
    }
  };

  const q = query.trim().toLowerCase();
  const people = (data?.people || []).filter((p) => !q || p.firstName.toLowerCase().includes(q));
  const blocked = data?.closed || null;
  const outOfInvites = Boolean(data && data.left <= 0);

  return (
    <BottomSheet title={T.bringTitle} onClose={onClose}>
      <p className="text-sm2 text-zine-inkMuted">
        {T.bringHint}
        {!event.isJoined && Number(event.creator?.telegramId) !== Number(telegramService.getUser()?.id) ? ` ${T.alsoJoinYou}` : ''}
      </p>

      {!data && !error && (
        <div className="py-10 flex justify-center text-zine-inkMuted">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
      {error && <p className="mt-4 p-3 rounded-zine-sm bg-zine-danger/10 text-zine-danger text-sm2 font-semibold">{error}</p>}
      {blocked && <p className="mt-4 p-3 rounded-zine-sm bg-zine-card text-sm2 text-zine-ink">{blocked}</p>}

      {data && !blocked && (
        <>
          <div className="mt-3">
            <LeftNote left={data.left} limit={data.limit} />
          </div>
          {data.people.length > 4 && (
            <label className="mt-3 h-11 px-3 rounded-full bg-zine-card flex items-center gap-2">
              <Search size={18} className="shrink-0 text-zine-inkMuted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={T.search}
                className="min-w-0 flex-1 bg-transparent text-body text-zine-ink placeholder:text-zine-inkMuted outline-none"
              />
            </label>
          )}

          {data.people.length === 0 ? (
            <p className="mt-3 p-3 rounded-zine-sm bg-zine-card text-sm2 text-zine-ink">{T.nobody}</p>
          ) : people.length === 0 ? (
            <p className="mt-3 text-sm2 text-zine-inkMuted">{T.nobodyFound}</p>
          ) : (
            <div className="mt-3 space-y-1">
              {people.map((p) => {
                const done = Boolean(p.invited);
                return (
                  <button
                    key={p.telegramId}
                    type="button"
                    disabled={done || outOfInvites || Boolean(sending)}
                    onClick={() => invite(p)}
                    className={`w-full py-2 flex items-center gap-3 text-left cursor-pointer ${done || outOfInvites ? 'opacity-60 cursor-default' : ''}`}
                  >
                    <Avatar src={p.avatarUrl} name={p.firstName} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold text-zine-ink truncate">
                        {p.firstName}
                        {p.age ? <span className="font-normal text-zine-inkMuted">, {p.age}</span> : null}
                      </span>
                      <span className="block text-cap text-zine-inkMuted truncate">{done ? T.invitedStatus[p.invited!] || '' : p.areaName}</span>
                    </span>
                    {sending === p.telegramId ? (
                      <Loader2 size={20} className="shrink-0 animate-spin text-zine-inkMuted" />
                    ) : (
                      !done && <span className="h-9 px-3 shrink-0 rounded-full bg-zine-terracotta text-white text-sm2 font-bold flex items-center">{T.bringBuddyShort}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
};
