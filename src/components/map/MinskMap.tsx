import React, { useRef, useMemo, useState, useEffect } from 'react';
import { YMaps, Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import { Navigation, Loader2 } from 'lucide-react';
import { UserProfile, AppEvent, ActivityGoal, GOALS_CONFIG, EVENT_CATEGORIES_CONFIG } from '../../types';
import { telegramService } from '../../services/telegram';

export interface MinskMapProps {
  users: UserProfile[];
  events?: AppEvent[];
  currentUser?: {
    telegramId?: number;
    name?: string;
    firstName?: string;
    username?: string;
    avatarUrl?: string;
    goal?: ActivityGoal;
    area?: string;
    coordinates?: [number, number];
    bio?: string;
    age?: string | number;
  } | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectCurrentUser?: () => void;
  onSelectEvent?: (event: AppEvent) => void;
  onToggleJoinEvent?: (event: AppEvent) => void;
  onUpdateLocation?: (coords: [number, number]) => void;
  onUpdateUserCoordinates?: (coords: [number, number]) => void;
  userLocation?: [number, number];
  apiKey?: string;
}

const MINSK_CENTER: [number, number] = [53.9045, 27.5615];

export function ensureLatLng(coords: any): [number, number] {
  if (!coords) return MINSK_CENTER;
  let lat = 0;
  let lng = 0;

  if (Array.isArray(coords) && coords.length >= 2) {
    const c0 = Number(coords[0]);
    const c1 = Number(coords[1]);
    if (c0 > 40 && c1 < 40) {
      lat = c0;
      lng = c1;
    } else if (c1 > 40 && c0 < 40) {
      lat = c1;
      lng = c0;
    } else {
      lat = c0;
      lng = c1;
    }
  }

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return MINSK_CENTER;
  }

  return [lat, lng];
}

// Алгоритм разведения маркеров (анти-коллизия)
function separateCoordinates(
  eventCoords: [number, number],
  obstacles: Array<[number, number]>,
  minDistDeg: number = 0.00075 // ~60-70 метров
): [number, number] {
  let [lat, lng] = eventCoords;

  for (let i = 0; i < obstacles.length; i++) {
    const [obsLat, obsLng] = obstacles[i];
    const dLat = lat - obsLat;
    const dLng = lng - obsLng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    if (dist < minDistDeg) {
      lat = obsLat + minDistDeg * 0.75;
      lng = obsLng + minDistDeg * 1.1;
      break;
    }
  }

  return [lat, lng];
}

const MinskMapContent: React.FC<{
  users: (UserProfile & { displayCoords: [number, number] })[];
  events: (AppEvent & { displayCoords: [number, number] })[];
  currentUser?: MinskMapProps['currentUser'];
  currentUserCoords: [number, number] | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectCurrentUser?: () => void;
  onSelectEvent?: (event: AppEvent) => void;
  mapInstance: any;
}> = ({
  users,
  events,
  currentUser,
  currentUserCoords,
  selectedUser,
  onSelectUser,
  onSelectCurrentUser,
  onSelectEvent,
  mapInstance
}) => {
  const ymaps = useYMaps(['templateLayoutFactory']);

  // Глобальный мост кликов для Telegram WebApp
  useEffect(() => {
    (window as any).__ymSelectUser = (userId: any) => {
      telegramService.haptic('selection');
      const target = users.find(
        (u) => String(u.id) === String(userId) || String(u.telegramId) === String(userId)
      );
      if (target) onSelectUser(target);
    };

    (window as any).__ymSelectCurrentUser = () => {
      telegramService.haptic('selection');
      onSelectCurrentUser?.();
    };

    (window as any).__ymSelectEvent = (eventId: any) => {
      telegramService.haptic('medium');
      const target = events.find(
        (ev) => String(ev.id) === String(eventId) || String((ev as any)._id) === String(eventId)
      );
      if (target) onSelectEvent?.(target);
    };

    return () => {
      delete (window as any).__ymSelectUser;
      delete (window as any).__ymSelectCurrentUser;
      delete (window as any).__ymSelectEvent;
    };
  }, [users, events, onSelectUser, onSelectCurrentUser, onSelectEvent]);

  // 1. Аватарка других пользователей
  const avatarLayout = useMemo(() => {
    if (!ymaps) return null;

    return (ymaps as any).templateLayoutFactory.createClass(
      `<div onclick="window.__ymSelectUser && window.__ymSelectUser('$[properties.userId]')" style="
        position: relative;
        width: 46px;
        height: 52px;
        cursor: pointer;
        user-select: none;
        pointer-events: auto !important;
      ">
        <div style="
          width: 46px;
          height: 46px;
          border-radius: 50%;
          padding: 2px;
          background-color: #FAF7F2;
          border: 2.5px solid $[properties.borderColor];
          box-shadow: 0 4px 14px rgba(43, 38, 35, 0.22);
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

  // 2. Аватарка ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ("⭐️ ТЫ")
  const currentUserLayout = useMemo(() => {
    if (!ymaps) return null;

    return (ymaps as any).templateLayoutFactory.createClass(
      `<div onclick="window.__ymSelectCurrentUser && window.__ymSelectCurrentUser()" style="
        position: relative;
        width: 54px;
        height: 68px;
        cursor: pointer;
        user-select: none;
        pointer-events: auto !important;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          background: #D95C3C;
          color: #FAF7F2;
          font-size: 9px;
          font-weight: 800;
          padding: 1.5px 7px;
          border-radius: 9px;
          border: 1.5px solid #FAF7F2;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 10;
        ">
          ⭐️ ТЫ
        </div>

        <div style="
          margin-top: 10px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          padding: 2.5px;
          background-color: #FAF7F2;
          border: 3.5px solid #D95C3C;
          box-shadow: 0 0 0 3px rgba(217, 92, 60, 0.4), 0 8px 22px rgba(43, 38, 35, 0.35);
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

  // 3. Маркер сходки
  const eventLayout = useMemo(() => {
    if (!ymaps) return null;

    return (ymaps as any).templateLayoutFactory.createClass(
      `<div onclick="window.__ymSelectEvent && window.__ymSelectEvent('$[properties.eventId]')" style="
        position: relative;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        user-select: none;
        pointer-events: auto !important;
      ">
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 36px;
          padding: 3px 8px 3px 5px;
          border-radius: 18px;
          background: #FAF7F2;
          border: 2px solid #E2A03F;
          box-shadow: 0 4px 14px rgba(43, 38, 35, 0.28);
          box-sizing: border-box;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <div style="
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: #E2A03F;
            color: #FAF7F2;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            line-height: 1;
            flex-shrink: 0;
          ">
            $[properties.eventEmoji]
          </div>

          <span style="
            font-size: 11.5px;
            font-weight: 700;
            color: #2B2623;
            max-width: 115px;
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
            font-weight: 800;
            border-radius: 10px;
            padding: 1px 5px;
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

  // 4. Кластер людей ("Х чел.")
  const clusterLayout = useMemo(() => {
    if (!ymaps) return null;

    return (ymaps as any).templateLayoutFactory.createClass(
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
        box-shadow: 0 4px 14px rgba(217, 92, 60, 0.45);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        cursor: pointer;
        user-select: none;
      ">
        <span style="font-size: 14px; font-weight: 800; line-height: 1;">$[properties.geoObjects.length]</span>
        <span style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; margin-top: 1px; letter-spacing: 0.5px; opacity: 0.95;">чел.</span>
      </div>`
    );
  }, [ymaps]);

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
      {/* 1. Маркер "⭐️ ТЫ" (без iconShape, с прямой обработкой клика) */}
      {currentUser && currentUserCoords && (
        <Placemark
          key={`current-user-${currentUserCoords[0]}-${currentUserCoords[1]}`}
          geometry={currentUserCoords}
          properties={{
            avatarUrl:
              currentUser.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            name: currentUser.name || currentUser.firstName || 'Ты',
            goalEmoji: (GOALS_CONFIG[currentUser.goal || 'walk'] || { emoji: '☕️' }).emoji
          }}
          options={{
            iconLayout: currentUserLayout,
            iconOffset: [-27, -68],
            cursor: 'pointer',
            zIndex: 1000,
            hasBalloon: false
          }}
          onClick={() => {
            telegramService.haptic('selection');
            onSelectCurrentUser?.();
            if (mapInstance && currentUserCoords) {
              mapInstance.panTo(currentUserCoords, { flying: true, duration: 400 });
            }
          }}
        />
      )}

      {/* 2. Кластер участников */}
      <Clusterer
        options={{
          clusterIconLayout: clusterLayout,
          clusterIconOffset: [-22, -22],
          gridSize: 64,
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterOpenBalloonOnClick: false,
          hasBalloon: false
        }}
        onClick={(e: any) => {
          const target = e.get('target');
          if (target && target.properties) {
            const user = target.properties.get('userObj');
            if (user) {
              telegramService.haptic('selection');
              onSelectUser(user);
              if (mapInstance && user.displayCoords) {
                mapInstance.panTo(user.displayCoords, { flying: true, duration: 400 });
              }
            }
          }
        }}
      >
        {otherUsers.map((user) => {
          const isSelected = selectedUser?.id === user.id;
          const goalInfo = GOALS_CONFIG[user.goal] || { emoji: '☕️', label: 'Досуг' };
          const coords = ensureLatLng(user.displayCoords);

          return (
            <Placemark
              key={`user-${user.id}`}
              geometry={coords}
              properties={{
                userId: user.id || (user as any).telegramId,
                userObj: user,
                avatarUrl: user.avatarUrl,
                name: user.firstName,
                goalEmoji: goalInfo.emoji,
                borderColor: isSelected ? '#D95C3C' : '#FAF7F2'
              }}
              options={{
                iconLayout: avatarLayout,
                iconOffset: [-23, -52],
                cursor: 'pointer',
                hasBalloon: false
              }}
              onClick={() => {
                telegramService.haptic('selection');
                onSelectUser(user);
                if (mapInstance) {
                  mapInstance.panTo(coords, { flying: true, duration: 400 });
                }
              }}
            />
          );
        })}
      </Clusterer>

      {/* 3. Маркеры сходок с защитой от наложения */}
      {events.map((ev) => {
        const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || { emoji: '⭐️', label: 'Сходка' };
        const rawTitle = ev.title || 'Сходка';
        const displayTitle = rawTitle.length > 13 ? rawTitle.slice(0, 12).trim() + '…' : rawTitle;
        const coords = ev.displayCoords;

        return (
          <Placemark
            key={`event-${ev.id || (ev as any)._id}-${coords[0]}-${coords[1]}`}
            geometry={coords}
            properties={{
              eventId: ev.id || (ev as any)._id,
              eventEmoji: catConfig.emoji || '⭐️',
              displayTitle,
              participantsCount: ev.participantsCount || 1
            }}
            options={{
              iconLayout: eventLayout,
              iconOffset: [-40, -42],
              cursor: 'pointer',
              zIndex: 800,
              hasBalloon: false
            }}
            onClick={() => {
              telegramService.haptic('medium');
              onSelectEvent?.(ev);
              if (mapInstance) {
                mapInstance.panTo(coords, { flying: true, duration: 400 });
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
  onUpdateLocation,
  onUpdateUserCoordinates,
  userLocation,
  apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || ''
}) => {
  const mapRef = useRef<any>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Локальные координаты GPS для мгновенного перемещения аватарки
  const [gpsCoords, setGpsCoords] = useState<[number, number] | null>(null);

  const handleCoordsUpdate = onUpdateUserCoordinates || onUpdateLocation;

  const currentUserCoords = useMemo(() => {
    if (gpsCoords) return gpsCoords;
    if (currentUser?.coordinates) {
      return ensureLatLng(currentUser.coordinates);
    }
    return null;
  }, [gpsCoords, currentUser?.coordinates]);

  const mapCenter = useMemo(() => {
    if (currentUserCoords) return currentUserCoords;
    if (userLocation) return ensureLatLng(userLocation);
    return MINSK_CENTER;
  }, [currentUserCoords, userLocation]);

  const usersWithSafeCoords = useMemo(() => {
    return users.map((user) => ({
      ...user,
      displayCoords: ensureLatLng(user.coordinates)
    }));
  }, [users]);

  // Разводим маркеры сходок, если они накладываются на пользователя или другие точки
  const eventsWithSeparatedCoords = useMemo(() => {
    const obstacleList: Array<[number, number]> = [];

    if (currentUserCoords) {
      obstacleList.push(currentUserCoords);
    }

    usersWithSafeCoords.forEach((u) => {
      obstacleList.push(u.displayCoords);
    });

    return events.map((ev) => {
      const originalCoords = ensureLatLng(ev.coordinates);
      const separated = separateCoordinates(originalCoords, obstacleList, 0.00075);
      obstacleList.push(separated);
      return {
        ...ev,
        displayCoords: separated
      };
    });
  }, [events, currentUserCoords, usersWithSafeCoords]);

  // Кнопка GPS (📍)
  const handleLocateGPS = () => {
    telegramService.haptic('light');

    if (!navigator.geolocation) {
      if (mapRef.current) {
        mapRef.current.setCenter(mapCenter, 14, { duration: 500 });
      }
      return;
    }

    setIsGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const newCoords: [number, number] = [lat, lng];

        // 1. Мгновенно обновляем положение аватарки "⭐️ ТЫ"
        setGpsCoords(newCoords);

        telegramService.haptic('success');

        // 2. Отправляем в родительский компонент и на бэкенд
        if (handleCoordsUpdate) {
          handleCoordsUpdate(newCoords);
        }

        // 3. Плавно центрируем карту
        if (mapRef.current) {
          mapRef.current.setCenter(newCoords, 15, { duration: 500 });
        }
      },
      (err) => {
        setIsGpsLoading(false);
        console.warn('GPS error in map:', err);
        if (mapRef.current) {
          mapRef.current.setCenter(mapCenter, 14, { duration: 500 });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-zine-paper">
      <style>{`
        .ymaps-2-1-79-map,
        .ymaps-2-1-79-islets_map {
          filter: sepia(20%) brightness(99%) contrast(94%) hue-rotate(-8deg) !important;
        }
        .ymaps-2-1-79-inner-panes {
          background-color: #F4EFE7 !important;
        }
      `}</style>

      <YMaps
        query={{
          apikey: apiKey,
          lang: 'ru_RU',
          load: 'package.full'
        }}
      >
        <Map
          defaultState={{
            center: mapCenter,
            zoom: 14,
            controls: []
          }}
          options={{
            suppressMapOpenBlock: true
          }}
          className="w-full h-full"
          instanceRef={(ref) => {
            if (ref) {
              mapRef.current = ref;
            }
          }}
        >
          <MinskMapContent
            users={usersWithSafeCoords}
            events={eventsWithSeparatedCoords}
            currentUser={currentUser}
            currentUserCoords={currentUserCoords}
            selectedUser={selectedUser}
            onSelectUser={onSelectUser}
            onSelectCurrentUser={onSelectCurrentUser}
            onSelectEvent={onSelectEvent}
            mapInstance={mapRef.current}
          />
        </Map>
      </YMaps>

      {/* Кнопка "Где я?" (GPS) */}
      <button
        onClick={handleLocateGPS}
        disabled={isGpsLoading}
        className="absolute bottom-4 right-4 z-20 w-11 h-11 rounded-full bg-white/95 backdrop-blur-md border border-zine-border shadow-zine-float flex items-center justify-center text-zine-ink hover:text-zine-terracotta active:scale-95 transition-all cursor-pointer"
        title="Определить мое местоположение"
      >
        {isGpsLoading ? (
          <Loader2 size={18} className="animate-spin text-zine-terracotta" />
        ) : (
          <Navigation size={18} className="text-zine-terracotta" />
        )}
      </button>
    </div>
  );
};

export default MinskMap;
