import React, { useEffect, useState } from 'react';
import { thumb } from '../../utils/thumb';
import { Loader2, ChevronRight } from 'lucide-react';
import { UserProfile } from '../../types';
import { api } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';
import { WISH_TEXTS as T } from '../../texts/wishes';

/**
 * «Кто ещё хочет» — участники группы совпадения (из сообщения бота). Нажать — анкета
 */
export const WishMembersSheet: React.FC<{
  groupId: string;
  onOpenUser: (user: UserProfile) => void;
  onOpenEvent?: (eventId: string) => void;
  onClose: () => void;
}> = ({ groupId, onOpenUser, onOpenEvent, onClose }) => {
  const [members, setMembers] = useState<UserProfile[] | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [askingPlace, setAskingPlace] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [placeText, setPlaceText] = useState('');
  const [busy, setBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeDone, setPlaceDone] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWishGroupMembers(groupId)
      .then((r) => {
        setMembers(r.members || []);
        setEventId(r.eventId || null);
        setAskingPlace(Boolean(r.askingPlace));
        setPlaceName(r.placeName || null);
      })
      .catch(() => setError(true));
  }, [groupId]);

  const sendPlace = async () => {
    if (!placeText.trim() || busy) return;
    setBusy(true);
    setPlaceError(null);
    try {
      const res = await api.suggestGroupPlace(groupId, placeText.trim());
      telegramService.haptic('success');
      setPlaceDone(res.message);
      setAskingPlace(false);
    } catch (err: any) {
      telegramService.haptic('error');
      setPlaceError(err?.message || T.placeFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={T.membersTitle} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{T.membersHint}</p>
      {eventId && onOpenEvent && (
        <button onClick={() => onOpenEvent(eventId)} className="mt-4 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
          {T.membersEvent}
        </button>
      )}
      {askingPlace && (
        <div className="mt-4 p-4 rounded-zine-sm bg-zine-card">
          <p className="text-lead font-bold text-zine-ink">{T.placeTitle}</p>
          <p className="mt-1 text-sm2 text-zine-inkMuted">{T.placeHint}</p>
          <textarea value={placeText} onChange={(e) => setPlaceText(e.target.value.slice(0, 500))} rows={3} placeholder={T.placePlaceholder} className="field mt-3" />
          <p className="mt-1.5 text-cap text-zine-inkMuted">{T.placeHowTo}</p>
          {placeError && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{placeError}</p>}
          <button
            onClick={sendPlace}
            disabled={!placeText.trim() || busy}
            className={`mt-3 w-full h-12 rounded-zine-sm text-body font-bold flex items-center justify-center cursor-pointer ${
              placeText.trim() ? 'bg-zine-terracotta text-white' : 'bg-zine-cardElevated text-zine-inkMuted cursor-default'
            }`}
          >
            {busy ? <Loader2 size={20} className="animate-spin" /> : T.placeSend}
          </button>
        </div>
      )}
      {placeDone && <p className="mt-4 p-3 rounded-zine-sm bg-zine-card text-body font-semibold text-zine-ink">{placeDone}</p>}
      {!askingPlace && !placeDone && placeName && <p className="mt-4 text-body font-semibold text-zine-ink">{T.placeChosen(placeName)}</p>}
      <div className="mt-4 space-y-2">
        {error ? (
          <p className="text-sm2 text-zine-inkMuted">{T.membersGone}</p>
        ) : !members ? (
          <Loader2 size={22} className="animate-spin text-zine-inkMuted" />
        ) : members.length === 0 ? (
          <p className="text-sm2 text-zine-inkMuted">{T.membersGone}</p>
        ) : (
          members.map((u) => (
            <button key={u.telegramId} onClick={() => onOpenUser(u)} className="w-full p-3 rounded-zine-sm bg-zine-card flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform">
              <img src={thumb(u.avatarUrl)} alt={u.firstName} className="w-14 h-14 rounded-full object-cover bg-zine-cardElevated shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-bold text-zine-ink truncate">
                  {u.firstName}
                  {u.age ? `, ${u.age}` : ''}
                </span>
                <span className="block text-sm2 text-zine-inkMuted truncate">{u.isTourist ? 'В Минске проездом' : u.areaName || 'Минск'}</span>
                {u.bio && <span className="block text-sm2 text-zine-ink line-clamp-1">{u.bio}</span>}
              </span>
              <ChevronRight size={20} className="shrink-0 text-zine-inkMuted" />
            </button>
          ))
        )}
      </div>
    </BottomSheet>
  );
};
