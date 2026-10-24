import React, { useEffect, useState } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { UserProfile } from '../../types';
import { api } from '../../services/api';
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

  useEffect(() => {
    api
      .getWishGroupMembers(groupId)
      .then((r) => {
        setMembers(r.members || []);
        setEventId(r.eventId || null);
      })
      .catch(() => setError(true));
  }, [groupId]);

  return (
    <BottomSheet title={T.membersTitle} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{T.membersHint}</p>
      {eventId && onOpenEvent && (
        <button onClick={() => onOpenEvent(eventId)} className="mt-4 w-full h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
          {T.membersEvent}
        </button>
      )}
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
              <img src={u.avatarUrl} alt={u.firstName} className="w-14 h-14 rounded-full object-cover bg-zine-cardElevated shrink-0" />
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
