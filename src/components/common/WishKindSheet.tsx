import React, { useEffect, useState } from 'react';
import { thumb } from '../../utils/thumb';
import { Loader2, Check } from 'lucide-react';
import { UserProfile, WishWindow } from '../../types';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';
import { WISH_TEXTS as T } from '../../texts/wishes';

// Сколько человек можно позвать в компанию за раз (на сервере то же ограничение)
export const INVITE_MAX = 10;

export type WishInvite = { id: number; name: string };

type People = Awaited<ReturnType<typeof api.getWishKindPeople>>;
// Открыли анкету из списка — шторка закрывается; вернулись — тот же список и те же галочки
let kept: { key: string; data: People | null; picked: WishInvite[] } | null = null;

/**
 * «Тоже хотят»: все, у кого такое же желание. Каждому можно передать 👋,
 * а можно отметить нескольких и позвать в компанию: соберёшь сходку, и бот пришлёт им приглашение от тебя.
 * Открывается из строки на карточке в «Людях» и из счётчика «76 человек хотят на кофе на неделе»
 */
export const WishKindSheet: React.FC<{
  kind: string;
  sport?: string; // «Своё» желание: его текст
  exact?: {
    window: WishWindow;
    placeId?: string | null;
    counter: string;
    includesMe: boolean;
  }; // из счётчика: только это окно и место
  onOpenUser: (user: UserProfile) => void;
  onHello: (user: UserProfile) => Promise<void>;
  onBuild: (kind: string, wishGroupId: string | null, invite: WishInvite[]) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenAll?: () => void; // все желания, мои и форма «Куда хочется?»
  onClose: () => void;
}> = ({ kind, sport, exact, onOpenUser, onHello, onBuild, onOpenEvent, onOpenAll, onClose }) => {
  const key = [kind, sport, exact?.window, exact?.placeId].join('|');
  const back = kept?.key === key ? kept : null;
  const [data, setData] = useState<People | null>(back?.data || null);
  const [error, setError] = useState(false);
  const [picked, setPicked] = useState<WishInvite[]>(back?.picked || []);
  kept = { key, data, picked };
  const [helloBusy, setHelloBusy] = useState<number | null>(null);
  const [meToo, setMeToo] = useState<'idle' | 'busy' | 'done'>(exact?.includesMe ? 'done' : 'idle');

  useEffect(() => {
    api
      .getWishKindPeople(kind, sport, exact && { window: exact.window, placeId: exact.placeId })
      .then(setData)
      .catch(() => !back?.data && setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sport, exact?.window, exact?.placeId]);

  const toggle = (u: UserProfile) => {
    const on = picked.some((p) => p.id === u.telegramId);
    if (!on && picked.length >= INVITE_MAX) {
      telegramService.alert(T.inviteLimit(INVITE_MAX));
      return;
    }
    telegramService.haptic('selection');
    setPicked(on ? picked.filter((p) => p.id !== u.telegramId) : [...picked, { id: u.telegramId, name: u.firstName }]);
  };

  const hello = async (u: UserProfile) => {
    if (u.iLiked || helloBusy) return;
    setHelloBusy(u.telegramId);
    await onHello(u);
    setHelloBusy(null);
    setData(
      (d) =>
        d && {
          ...d,
          people: d.people.map((p) => (p.telegramId === u.telegramId ? { ...p, iLiked: true } : p))
        }
    );
  };

  // «Я тоже хочу»: то же желание на то же время
  const joinWish = async () => {
    if (!exact || meToo !== 'idle') return;
    setMeToo('busy');
    try {
      await api.createWish({
        kind,
        sport: sport || null,
        timeWindow: exact.window,
        placeId: exact.placeId || null
      });
      telegramService.haptic('success');
      setMeToo('done');
    } catch (err: any) {
      setMeToo('idle');
      telegramService.alert(err?.message || T.failed);
    }
  };

  const footer = data?.eventId ? (
    <button onClick={() => onOpenEvent(data.eventId!)} className="w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold cursor-pointer">
      {T.kindOpenEvent}
    </button>
  ) : data && data.people.length > 0 ? (
    <button
      onClick={() => {
        kept = null;
        onBuild(kind, data.wishGroupId, picked);
      }}
      className="w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold cursor-pointer active:scale-[0.99] transition-transform"
    >
      {picked.length ? T.inviteBuild(picked.length) : T.kindBuild}
    </button>
  ) : undefined;

  return (
    <BottomSheet
      title={data ? T.kindTitle(data.emoji, data.name) : T.membersTitle}
      onClose={() => {
        kept = null;
        onClose();
      }}
      footer={footer}
    >
      {exact && <p className="text-body font-bold text-zine-ink">🙋 {exact.counter}</p>}
      <p className={`text-sm2 text-zine-inkMuted ${exact ? 'mt-1' : ''}`}>{T.kindHint}</p>
      {exact && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={joinWish}
            disabled={meToo !== 'idle'}
            className={`h-10 px-4 rounded-full text-sm2 font-bold flex items-center gap-1.5 cursor-pointer disabled:cursor-default ${
              meToo === 'done' ? 'bg-zine-card text-zine-sage' : 'bg-zine-card text-zine-ink border border-zine-border'
            }`}
          >
            {meToo === 'busy' ? <Loader2 size={16} className="animate-spin" /> : meToo === 'done' ? T.meTooDone : T.meTooButton}
          </button>
          {onOpenAll && (
            <button
              onClick={() => {
                kept = null;
                onOpenAll();
              }}
              className="h-10 text-sm2 font-bold text-zine-terracotta cursor-pointer"
            >
              {T.allLink}
            </button>
          )}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {error ? (
          <p className="text-sm2 text-zine-inkMuted">{T.kindEmpty}</p>
        ) : !data ? (
          <Loader2 size={22} className="animate-spin text-zine-inkMuted" />
        ) : data.people.length === 0 ? (
          <p className="text-sm2 text-zine-inkMuted">{T.kindEmpty}</p>
        ) : (
          data.people.map((u) => {
            const on = picked.some((p) => p.id === u.telegramId);
            return (
              <div key={u.telegramId} className={`p-2 pr-2.5 rounded-zine-sm flex items-center gap-2 transition-colors ${on ? 'bg-zine-terracotta/10' : 'bg-zine-card'}`}>
                <button
                  onClick={() => toggle(u)}
                  aria-label={T.invitePick(u.firstName)}
                  aria-pressed={on}
                  className="w-9 h-11 shrink-0 flex items-center justify-center cursor-pointer"
                >
                  <span
                    className={`w-6 h-6 rounded-[7px] flex items-center justify-center border-2 ${on ? 'bg-zine-terracotta border-zine-terracotta text-white' : 'border-zine-border bg-zine-cardElevated'}`}
                  >
                    {on && <Check size={16} strokeWidth={3} />}
                  </span>
                </button>
                <button onClick={() => onOpenUser(u)} className="min-w-0 flex-1 flex items-center gap-3 text-left cursor-pointer">
                  <img src={thumb(u.avatarUrl)} alt={u.firstName} className="w-12 h-12 rounded-full object-cover bg-zine-cardElevated shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-bold text-zine-ink truncate">
                      {u.firstName}
                      {u.age ? `, ${u.age}` : ''}
                    </span>
                    <span className="block text-sm2 text-zine-inkMuted truncate">{u.isTourist ? 'В Минске проездом' : u.areaName || 'Минск'}</span>
                    {u.bio && <span className="text-sm2 text-zine-ink line-clamp-1">{u.bio}</span>}
                  </span>
                </button>
                {/* 👋 прямо из списка; на связи — открыть анкету, там «Написать» */}
                <button
                  onClick={() => (u.isMatch ? onOpenUser(u) : hello(u))}
                  disabled={!u.isMatch && Boolean(u.iLiked)}
                  aria-label={u.isMatch ? T.helloMatch : u.iLiked ? T.helloSent : T.hello}
                  className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[20px] leading-none cursor-pointer disabled:cursor-default ${
                    u.isMatch
                      ? 'bg-zine-sage/20'
                      : u.iLiked
                        ? 'bg-zine-cardElevated text-zine-sage'
                        : 'bg-zine-cardElevated border border-zine-border active:scale-90 transition-transform'
                  }`}
                >
                  {helloBusy === u.telegramId ? (
                    <Loader2 size={18} className="animate-spin text-zine-inkMuted" />
                  ) : u.isMatch ? (
                    '💬'
                  ) : u.iLiked ? (
                    <Check size={20} strokeWidth={3} />
                  ) : (
                    '👋'
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
};
