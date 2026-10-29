import React, { useEffect, useState } from 'react';
import { thumb } from '../../utils/thumb';
import { Loader2, ChevronRight } from 'lucide-react';
import { UserProfile } from '../../types';
import { api } from '../../services/api';
import { BottomSheet } from '../ui/BottomSheet';
import { WISH_TEXTS as T } from '../../texts/wishes';

/**
 * «Тоже хотят»: все, у кого такое же желание, и кнопка «Собрать сходку» (из строки на карточке в «Людях»)
 */
export const WishKindSheet: React.FC<{
  kind: string;
  sport?: string; // «Своё» желание: его текст
  onOpenUser: (user: UserProfile) => void;
  onBuild: (kind: string, wishGroupId: string | null) => void;
  onOpenEvent: (eventId: string) => void;
  onClose: () => void;
}> = ({ kind, sport, onOpenUser, onBuild, onOpenEvent, onClose }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getWishKindPeople>> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getWishKindPeople(kind, sport).then(setData).catch(() => setError(true));
  }, [kind, sport]);

  return (
    <BottomSheet title={data ? T.kindTitle(data.emoji, data.name) : T.membersTitle} onClose={onClose}>
      <p className="text-body text-zine-inkMuted">{T.kindHint}</p>
      {data?.eventId ? (
        <button onClick={() => onOpenEvent(data.eventId!)} className="mt-4 w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold cursor-pointer">
          {T.kindOpenEvent}
        </button>
      ) : (
        data && (
          <button onClick={() => onBuild(kind, data.wishGroupId)} className="mt-4 w-full h-14 rounded-zine-sm bg-zine-terracotta text-white text-lead font-bold cursor-pointer active:scale-[0.99] transition-transform">
            {T.kindBuild}
          </button>
        )
      )}
      <div className="mt-4 space-y-2">
        {error ? (
          <p className="text-sm2 text-zine-inkMuted">{T.kindEmpty}</p>
        ) : !data ? (
          <Loader2 size={22} className="animate-spin text-zine-inkMuted" />
        ) : data.people.length === 0 ? (
          <p className="text-sm2 text-zine-inkMuted">{T.kindEmpty}</p>
        ) : (
          data.people.map((u) => (
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
