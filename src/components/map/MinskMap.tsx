import React, { useRef, useMemo, useState } from 'react';
import { YMaps, Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import { Clock, MapPin, X, Sparkles, Check, Send } from 'lucide-react';
import { UserProfile, AppEvent, ActivityGoal, GOALS_CONFIG, EVENT_CATEGORIES_CONFIG } from '../../types';
import { telegramService } from '../../services/telegram';

interface MinskMapProps {
  users: UserProfile[];
  events?: AppEvent[];
  currentUser?: {
    telegramId?: number;
    name?: string;
    firstName?: string;
    avatarUrl?: string;
    goal?: ActivityGoal;
    area?: string;
    coordinates?: [number, number];
    bio?: string;
  } | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectCurrentUser?: () => void;
  onSelectEvent?: (event: AppEvent) => void;
  onToggleJoinEvent?: (event: AppEvent) => void;
  onUpdateUserCoordinates?: (coords: [number, number]) => void;
  userLocation?: [number, number];
  apiKey?: string;
}

const MINSK_CENTER: [number, number] = [53.9045, 27.5615];

const MinskMapContent: React.FC<{
  users: UserProfile[];
  events: AppEvent[];
  currentUser?: MinskMapProps['currentUser'];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectCurrentUser?: () => void;
  onSelectEvent?: (event: AppEvent) => void;
  mapInstance: any;
}> = ({
  users,
  events,
  currentUser,
  selectedUser,
  onSelectUser,
  onSelectCurrentUser,
  onSelectEvent,
  mapInstance
}) => {
  const ymaps = useYMaps(['templateLayoutFactory']);

  // 1. Макет аватарок пользователей (без HTML-комментариев!)
  const avatarLayout = useMemo(() => {
    if (!ymaps) return null;

    return ymaps.templateLayoutFactory.createClass(
      `<div style="cursor: pointer; transform: translate(-50%, -100%); position: relative; width: 46px; height: 52px;">
        <div style="
          width: 46px;
          height: 46px;
          border-radius: 50%;
          padding: 2px;
          background-color: #FAF7F2;
          border: 2.5px solid $[properties.borderColor];
          box-shadow: 0 4px 14px rgba(43, 38, 35, 0.25);
          position: relative;
          box-sizing: border-box;
        ">
          <img 
            src="$[properties.avatarUrl]" 
            alt="$[properties.name]" 
            style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" 
            onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'"
          />
          <span style="
            position: absolute;
            bottom: -3px;
            right: -3px;
            background: #FFFFFF;
            font-size: 11px;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #E8DFD5;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          ">
            $[properties.goalEmoji]
          </span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid $[properties.borderColor];
          margin: -1px auto 0 auto;
        "></div>
      </div>`
    );
  }, [ymaps]);

  // 2. Макет маркера текущего пользователя ("⭐️ ТЫ")
  const currentUserLayout = useMemo(() => {
    if (!ymaps) return null;

    return ymaps.templateLayoutFactory.createClass(
      `<div style="cursor: pointer; transform: translate(-50%, -100%); position: relative; width: 52px; height: 60px;">
        <div style="
          width: 52px;
          height: 52px;
          border-radius: 50%;
          padding: 2.5px;
          background-color: #FAF7F2;
          border: 3.5px solid #D95C3C;
          box-shadow: 0 0 0 4px rgba(217, 92, 60, 0.4), 0 8px 22px rgba(43, 38, 35, 0.35);
          position: relative;
          box-sizing: border-box;
        ">
          <span style="
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: #D95C3C;
            color: #FAF7F2;
            font-size: 8.5px;
            font-weight: 800;
            padding: 1.5px 6px;
            border-radius: 8px;
            border: 1.5px solid #FAF7F2;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            white-space: nowrap;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            ⭐️ ТЫ
          </span>

          <img 
            src="$[properties.avatarUrl]" 
            alt="$[properties.name]" 
            style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" 
            onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'"
          />
          <span style="
            position: absolute;
            bottom: -3px;
            right: -3px;
            background: #FAF7F2;
            font-size: 12px;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1.5px solid #D95C3C;
            box-shadow: 0 1px 4px rgba(0,0,0,0.15);
          ">
            $[properties.goalEmoji]
          </span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 7px solid #D95C3C;
          margin: -1px auto 0 auto;
        "></div>
      </div>`
    );
  }, [ymaps]);

  // 3. Макет маркера Сходки (эмодзи + название + участники)
  const eventLayout = useMemo(() => {
    if (!ymaps) return null;

    return ymaps.templateLayoutFactory.createClass(
      `<div style="cursor: pointer; transform: translate(-50%, -100%); position: relative;">
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 38px;
          padding: 3px 10px 3px 5px;
          border-radius: 19px;
          background: #FAF7F2;
          border: 2px solid #E2A03F;
          box-shadow: 0 4px 14px rgba(43, 38, 35, 0.28);
          position: relative;
          box-sizing: border-box;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <div style="
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #E2A03F;
            color: #FAF7F2;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            line-height: 1;
            flex-shrink: 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          ">
            $[properties.eventEmoji]
          </div>

          <span style="
            font-size: 11.5px;
            font-weight: 700;
            color: #2B2623;
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            letter-spacing: -0.2px;
          ">
            $[properties.displayTitle]
          </span>

          <span style="
            background: #D95C3C;
            color: #FAF7F2;
            font-size: 9.5px;
            font-weight: 700;
            border-radius: 10px;
            padding: 1.5px 5px;
            margin-left: -1px;
          ">
            $[properties.participantsCount]
          </span>
        </div>

        <div style="
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid #E2A03F;
          margin: -1px auto 0 auto;
        "></div>
      </div>`
    );
  }, [ymaps]);

  // 4. Макет кластера людей (пишет "ЧЕЛ." вместо "МЕСТА")
  const clusterLayout = useMemo(() => {
    if (!ymaps) return null;

    return ymaps.templateLayoutFactory.createClass(
      `<div style="
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background-color: #D95C3C;
        border: 2.5px solid #FAF7F2;
        color: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 700;
        box-shadow: 0 4px 14px rgba(217, 92, 60, 0.4);
        cursor: pointer;
        transform: translate(-50%, -50%);
      ">
        <span style="font-size: 13px; line-height: 1;">$[properties.geoObjects.length]</span>
        <span style="font-size: 7.5px; text-transform: uppercase; font-weight: 600; opacity: 0.95; margin-top: 1px; letter-spacing: 0.5px;">чел.</span>
      </div>`
    );
  }, [ymaps]);

  // Хитбоксы для кликабельности (SVG-области нажатия)
  const avatarShape = useMemo(() => ({
    type: 'Circle',
    coordinates: [0, -25],
    radius: 26
  }), []);

  const currentUserShape = useMemo(() => ({
    type: 'Circle',
    coordinates: [0, -28],
    radius: 32
  }), []);

  const eventShape = useMemo(() => ({
    type: 'Rectangle',
    coordinates: [[-85, -45], [85, 5]]
  }), []);

  const otherUsers = useMemo(() => {
    if (!currentUser?.telegramId) return users;
    return users.filter(
      (u) =>
        String(u.id) !== String(currentUser.telegramId) &&
        (u as any).telegramId !== currentUser.telegramId
    );
  }, [users, currentUser]);

  if (!ymaps || !avatarLayout || !clusterLayout || !eventLayout || !currentUserLayout) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zine-paper/70 backdrop-blur-xs">
        <div className="w-8 h-8 rounded-full border-2 border-zine-terracotta border-t-transparent animate-spin mb-2" />
        <span className="font-serif text-xs text-zine-ink font-medium">Загружаем карту Минска...</span>
      </div>
    );
  }

  return (
    <>
      {/* 1. Маркер "⭐️ ТЫ" */}
      {currentUser && currentUser.coordinates && (
        <Placemark
          key={`current-user-${currentUser.coordinates[0]}-${currentUser.coordinates[1]}`}
          geometry={currentUser.coordinates}
          properties={{
            avatarUrl:
              currentUser.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            name: currentUser.name || currentUser.firstName || 'Ты',
            goalEmoji: (GOALS_CONFIG[currentUser.goal || 'walk'] || { emoji: '☕️' }).emoji
          }}
          options={{
            iconLayout: currentUserLayout,
            iconShape: currentUserShape as any,
            cursor: 'pointer',
            zIndex: 950,
            hasBalloon: false
          }}
          instanceRef={(ref) => {
            if (ref) {
              ref.events.remove('click');
              ref.events.add('click', () => {
                telegramService.haptic('selection');
                if (onSelectCurrentUser) onSelectCurrentUser();
                if (mapInstance && currentUser.coordinates) {
                  mapInstance.panTo(currentUser.coordinates, { flying: true, duration: 400 });
                }
              });
            }
          }}
        />
      )}

      {/* 2. Кластеризация остальных пользователей */}
      <Clusterer
        options={{
          clusterIconLayout: clusterLayout,
          gridSize: 64,
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterHideIconOnBalloonOpen: false,
          geoObjectHideIconOnBalloonOpen: false
        }}
      >
        {otherUsers.map((user) => {
          const isSelected = selectedUser?.id === user.id;
          const goalInfo = GOALS_CONFIG[user.goal] || { emoji: '☕️', label: 'Досуг' };

          return (
            <Placemark
              key={`user-${user.id}`}
              geometry={user.coordinates}
              properties={{
                avatarUrl: user.avatarUrl,
                name: user.firstName,
                goalEmoji: goalInfo.emoji,
                borderColor: isSelected ? '#D95C3C' : '#FAF7F2'
              }}
              options={{
                iconLayout: avatarLayout,
                iconShape: avatarShape as any,
                cursor: 'pointer',
                hasBalloon: false
              }}
              instanceRef={(ref) => {
                if (ref) {
                  ref.events.remove('click');
                  ref.events.add('click', () => {
                    telegramService.haptic('selection');
                    onSelectUser(user);
                    if (mapInstance) {
                      mapInstance.panTo(user.coordinates, { flying: true, duration: 400 });
                    }
                  });
                }
              }}
            />
          );
        })}
      </Clusterer>

      {/* 3. Маркеры Сходок (кликабельные) */}
      {events.map((ev) => {
        const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || { emoji: '⭐️', label: 'Сходка' };
        const rawTitle = ev.title || 'Сходка';
        const displayTitle = rawTitle.length > 13 ? rawTitle.slice(0, 12).trim() + '…' : rawTitle;
        const coords = ev.coordinates || [53.9045, 27.5615];

        return (
          <Placemark
            key={`event-${ev.id || (ev as any)._id}-${coords[0]}-${coords[1]}`}
            geometry={coords}
            properties={{
              eventEmoji: catConfig.emoji || '⭐️',
              displayTitle,
              fullTitle: rawTitle,
              participantsCount: ev.participantsCount || 1
            }}
            options={{
              iconLayout: eventLayout,
              iconShape: eventShape as any,
              cursor: 'pointer',
              zIndex: 1000,
              hasBalloon: false
            }}
            instanceRef={(ref) => {
              if (ref) {
                ref.events.remove('click');
                ref.events.add('click', () => {
                  telegramService.haptic('medium');
                  if (onSelectEvent) onSelectEvent(ev);
                  if (mapInstance) {
                    mapInstance.panTo(coords, { flying: true, duration: 400 });
                  }
                });
              }
            }}
          />
        );
      })}
    </>
  );
};

export const MinskMap: React.FC<MinskMapProps> = ({
  users,
  events = [],
  currentUser,
  selectedUser,
  onSelectUser,
  onSelectCurrentUser,
  onSelectEvent,
  onToggleJoinEvent,
  onUpdateUserCoordinates,
  userLocation,
  apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || ''
}) => {
  const mapRef = useRef<any>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [cardEvent, setCardEvent] = useState<AppEvent | null>(null);

  const handleEventClick = (ev: AppEvent) => {
    if (onSelectEvent) {
      onSelectEvent(ev);
    } else {
      setCardEvent(ev);
    }
  };

  // Определение GPS с реальным перемещением маркера пользователя
  const handleLocateGPS = () => {
    telegramService.haptic('light');

    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим устройством');
      return;
    }

    setIsGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        telegramService.haptic('success');

        // 1. Центрируем карту
        if (mapRef.current) {
          mapRef.current.setCenter([lat, lng], 15, { duration: 500 });
        }

        // 2. Обновляем координаты маркера "⭐️ ТЫ"
        if (onUpdateUserCoordinates) {
          onUpdateUserCoordinates([lat, lng]);
        }
      },
      (err) => {
        setIsGpsLoading(false);
        console.warn('GPS error:', err);
        alert('Не удалось получить координаты GPS. Убедитесь, что геолокация включена в телефоне.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const formatEventDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('ru-RU', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-zine-paper">
      <style>{`
        .ymaps-2-1-79-map,
        .ymaps-2-1-79-islets_map {
          filter: sepia(18%) brightness(99%) contrast(95%) hue-rotate(-6deg) !important;
        }
        .ymaps-2-1-79-inner-panes {
          background-color: #F4EFE7 !important;
        }
      `}</style>

      <YMaps query={{ apikey: apiKey, lang: 'ru_RU', load: 'package.full' }}>
        <Map
          defaultState={{
            center: currentUser?.coordinates || MINSK_CENTER,
            zoom: 13,
            controls: []
          }}
          options={{ suppressMapOpenBlock: true }}
          className="w-full h-full"
          instanceRef={(ref) => {
            if (ref) mapRef.current = ref;
          }}
        >
          <MinskMapContent
            users={users}
            events={events}
            currentUser={currentUser}
            selectedUser={selectedUser}
            onSelectUser={(u) => {
              setCardEvent(null);
              onSelectUser(u);
            }}
            onSelectCurrentUser={onSelectCurrentUser}
            onSelectEvent={handleEventClick}
            mapInstance={mapRef.current}
          />
        </Map>
      </YMaps>

      {/* Автономная карточка сходки */}
      {!onSelectEvent && cardEvent && (
        <div className="absolute bottom-20 inset-x-3 bg-zine-cardElevated rounded-2xl border border-zine-border p-3.5 shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-start justify-between mb-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF4E6] text-[#B87C24] border border-[#F3E2B8]">
              <span>{EVENT_CATEGORIES_CONFIG[cardEvent.category]?.emoji || '⭐️'}</span>
              <span>Сходка в Минске</span>
            </span>
            <button
              onClick={() => setCardEvent(null)}
              className="w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>

          <h3 className="font-serif font-bold text-sm text-zinc-900 leading-snug mb-1">
            {cardEvent.title}
          </h3>

          <div className="flex items-center gap-3 text-[11px] text-zinc-600 mb-2">
            <span className="flex items-center gap-1 text-zine-terracotta font-semibold">
              <Clock size={11} strokeWidth={2.4} />
              <span>{formatEventDate(cardEvent.dateTime)}</span>
            </span>
            <span className="flex items-center gap-1 truncate">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{cardEvent.locationName}</span>
            </span>
          </div>

          <p className="text-xs text-zinc-700 leading-snug line-clamp-2 mb-3">
            {cardEvent.description}
          </p>

          <div className="flex items-center gap-2">
            {onToggleJoinEvent && (
              <button
                onClick={() => {
                  onToggleJoinEvent(cardEvent);
                  setCardEvent({ ...cardEvent, isJoined: !cardEvent.isJoined });
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer ${
                  cardEvent.isJoined
                    ? 'bg-zine-sage text-white'
                    : 'bg-zine-terracotta hover:bg-zine-terracottaHover text-white'
                }`}
              >
                {cardEvent.isJoined ? (
                  <>
                    <Check size={13} strokeWidth={3} />
                    <span>Ты идёшь (Отменить)</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    <span>Присоединиться к сходке</span>
                  </>
                )}
              </button>
            )}

            {cardEvent.creator?.username && (
              <button
                onClick={() => {
                  telegramService.haptic('medium');
                  telegramService.openChat(cardEvent.creator.username);
                }}
                className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 active:scale-95 transition-all cursor-pointer"
                title="Написать организатору"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Кнопка "Где я?" (GPS) */}
      <button
        onClick={handleLocateGPS}
        disabled={isGpsLoading}
        className="absolute right-3.5 bottom-28 w-11 h-11 rounded-2xl bg-zine-cardElevated/95 backdrop-blur-md border border-zine-border shadow-zine flex items-center justify-center text-sm z-20 active:scale-90 transition-transform cursor-pointer"
        title="Определить мое местоположение (GPS)"
      >
        <span className={isGpsLoading ? 'animate-spin' : ''}>📍</span>
      </button>
    </div>
  );
};

export default MinskMap;
