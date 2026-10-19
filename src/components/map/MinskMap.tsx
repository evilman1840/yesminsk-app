import React, { useRef, useMemo, useState, useEffect } from 'react';
import { YMaps, Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import { Clock, MapPin, X, Send, Check, Sparkles } from 'lucide-react';
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
  applyFuzzyOffset?: boolean;
}

const MINSK_CENTER: [number, number] = [53.9045, 27.5615];

/**
 * Безопасное приведение координат к формату [lat, lng]
 */
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

/**
 * Разведение накладывающихся меток сходок и людей (анти-коллизия).
 */
function separateCoordinates(
  eventCoords: [number, number],
  existingPoints: [number, number][],
  indexOffset: number
): [number, number] {
  let [lat, lng] = eventCoords;
  for (const pt of existingPoints) {
    const dLat = Math.abs(lat - pt[0]);
    const dLng = Math.abs(lng - pt[1]);
    if (dLat < 0.0018 && dLng < 0.0018) {
      const angle = ((indexOffset * 75 + 30) * Math.PI) / 180;
      lat += 0.0024 * Math.cos(angle);
      lng += 0.0024 * Math.sin(angle);
    }
  }
  return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
}

export function obfuscateCoordinates(
  lat: number,
  lng: number,
  minMeters: number = 300,
  maxMeters: number = 500
): [number, number] {
  const EARTH_RADIUS = 6378137;
  const radius = minMeters + Math.random() * (maxMeters - minMeters);
  const angle = Math.random() * 2 * Math.PI;

  const deltaLat = (radius * Math.cos(angle)) / EARTH_RADIUS;
  const deltaLng = (radius * Math.sin(angle)) / (EARTH_RADIUS * Math.cos((lat * Math.PI) / 180));

  const fuzzyLat = Number((lat + (deltaLat * 180) / Math.PI).toFixed(6));
  const fuzzyLng = Number((lng + (deltaLng * 180) / Math.PI).toFixed(6));

  return [fuzzyLat, fuzzyLng];
}

const MinskMapContent: React.FC<{
  users: (UserProfile & { displayCoords: [number, number] })[];
  events: AppEvent[];
  currentUser?: MinskMapProps['currentUser'];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectCurrentUser?: () => void;
  onSelectEvent?: (event: AppEvent) => void;
  mapInstance: any;
  currentUserCoords: [number, number] | null;
}> = ({
  users,
  events,
  currentUser,
  selectedUser,
  onSelectUser,
  onSelectCurrentUser,
  onSelectEvent,
  mapInstance,
  currentUserCoords
}) => {
  const ymapsHook = useYMaps();
  const ymaps = ymapsHook || (typeof window !== 'undefined' ? (window as any).ymaps : null);
  const lastDirectClickTs = useRef<number>(0);

  // Глобальный direct-мост для мгновенного отклика на клики и тапы в мобильном WebView
  useEffect(() => {
    (window as any).__ymSelectUserDirect = (user: UserProfile) => {
      const now = Date.now();
      if (now - lastDirectClickTs.current < 250) return;
      lastDirectClickTs.current = now;

      telegramService.haptic('selection');
      onSelectUser(user);
      if (mapInstance && user.coordinates) {
        mapInstance.panTo(ensureLatLng(user.coordinates), { flying: true, duration: 400 });
      }
    };

    (window as any).__ymSelectCurrentUserDirect = () => {
      const now = Date.now();
      if (now - lastDirectClickTs.current < 250) return;
      lastDirectClickTs.current = now;

      telegramService.haptic('selection');
      if (onSelectCurrentUser) {
        onSelectCurrentUser();
      }
      if (mapInstance && currentUserCoords) {
        mapInstance.panTo(currentUserCoords, { flying: true, duration: 400 });
      }
    };

    (window as any).__ymSelectEventDirect = (ev: AppEvent) => {
      const now = Date.now();
      if (now - lastDirectClickTs.current < 250) return;
      lastDirectClickTs.current = now;

      telegramService.haptic('medium');
      if (onSelectEvent) {
        onSelectEvent(ev);
      }
      if (mapInstance && ev.coordinates) {
        mapInstance.panTo(ensureLatLng(ev.coordinates), { flying: true, duration: 400 });
      }
    };

    return () => {
      delete (window as any).__ymSelectUserDirect;
      delete (window as any).__ymSelectCurrentUserDirect;
      delete (window as any).__ymSelectEventDirect;
    };
  }, [onSelectUser, onSelectCurrentUser, onSelectEvent, currentUserCoords, mapInstance]);

  // 1. Макет круглой аватарки других людей с гарантированным кликом и тачем
  const avatarLayout = useMemo(() => {
    if (!ymaps) return null;

    return (ymaps as any).templateLayoutFactory.createClass(
      `<div 
        class="ymaps-avatar-marker" 
        onclick="window.__ymSelectUser && window.__ymSelectUser('$[properties.userId]')"
        ontouchend="window.__ymSelectUser && window.__ymSelectUser('$[properties.userId]')"
        style="position: relative; width: 46px; height: 52px; cursor: pointer; user-select: none; pointer-events: auto !important; -webkit-tap-highlight-color: transparent;"
      >
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
          pointer-events: auto;
        ">
          <img 
            src="$[properties.avatarUrl]" 
            alt="$[properties.name]" 
            style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; pointer-events: none;" 
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
            pointer-events: none;
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
          pointer-events: none;
        "></div>
      </div>`,
      {
        build: function () {
          (this as any).constructor.superclass.build.call(this);
          const el = (this as any).getElement ? (this as any).getElement() : null;
          if (el) {
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';
            const self = this as any;
            const trigger = (e?: any) => {
              if (e && e.stopPropagation) e.stopPropagation();
              const userObj = self.getData()?.properties?.get('userObj');
              const userId = self.getData()?.properties?.get('userId');
              if (userObj && (window as any).__ymSelectUserDirect) {
                (window as any).__ymSelectUserDirect(userObj);
              } else if (userId && (window as any).__ymSelectUser) {
                (window as any).__ymSelectUser(String(userId));
              }
              const geoObj = self.getData()?.geoObject;
              if (geoObj) {
                geoObj.events.fire('click', { target: geoObj });
              }
            };
            self._clickHandler = trigger;
            el.addEventListener('click', trigger);
            el.addEventListener('touchend', trigger);
          }
        },
        clear: function () {
          const el = (this as any).getElement ? (this as any).getElement() : null;
          if (el && (this as any)._clickHandler) {
            el.removeEventListener('click', (this as any)._clickHandler);
            el.removeEventListener('touchend', (this as any)._clickHandler);
          }
          (this as any).constructor.superclass.clear.call(this);
        }
      }
    );
  }, [ymaps]);

  // 2. Макет аватарки ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ("⭐️ ТЫ")
  const currentUserLayout = useMemo(() => {
    if (!ymaps) return null;

    return (ymaps as any).templateLayoutFactory.createClass(
      `<div 
        class="ymaps-current-user-marker" 
        onclick="window.__ymSelectCurrentUser && window.__ymSelectCurrentUser()"
        ontouchend="window.__ymSelectCurrentUser && window.__ymSelectCurrentUser()"
        style="position: relative; width: 54px; height: 68px; cursor: pointer; user-select: none; pointer-events: auto !important; -webkit-tap-highlight-color: transparent;"
      >
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
          pointer-events: none;
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
          pointer-events: auto;
        ">
          <img 
            src="$[properties.avatarUrl]" 
            alt="$[properties.name]" 
            style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; pointer-events: none;" 
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
            pointer-events: none;
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
          pointer-events: none;
        "></div>
      </div>`,
      {
        build: function () {
          (this as any).constructor.superclass.build.call(this);
          const el = (this as any).getElement ? (this as any).getElement() : null;
          if (el) {
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';
            const self = this as any;
            const trigger = (e?: any) => {
              if (e && e.stopPropagation) e.stopPropagation();
              if ((window as any).__ymSelectCurrentUserDirect) {
                (window as any).__ymSelectCurrentUserDirect();
              } else if ((window as any).__ymSelectCurrentUser) {
                (window as any).__ymSelectCurrentUser();
              }
              const geoObj = self.getData()?.geoObject;
              if (geoObj) {
                geoObj.events.fire('click', { target: geoObj });
              }
            };
            self._clickHandler = trigger;
            el.addEventListener('click', trigger);
            el.addEventListener('touchend', trigger);
          }
        },
        clear: function () {
          const el = (this as any).getElement ? (this as any).getElement() : null;
          if (el && (this as any)._clickHandler) {
            el.removeEventListener('click', (this as any)._clickHandler);
            el.removeEventListener('touchend', (this as any)._clickHandler);
          }
          (this as any).constructor.superclass.clear.call(this);
        }
      }
    );
  }, [ymaps]);

  // 3. Макет маркера СХОДКИ
  const eventLayout = useMemo(() => {
    if (!ymaps) return null;

    return (ymaps as any).templateLayoutFactory.createClass(
      `<div 
        class="ymaps-event-marker" 
        onclick="window.__ymSelectEvent && window.__ymSelectEvent('$[properties.eventId]')"
        ontouchend="window.__ymSelectEvent && window.__ymSelectEvent('$[properties.eventId]')"
        style="position: relative; display: inline-flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none; pointer-events: auto !important; -webkit-tap-highlight-color: transparent;"
      >
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 38px;
          padding: 3px 10px 3px 6px;
          border-radius: 19px;
          background: #FAF7F2;
          border: 2px solid #E2A03F;
          box-shadow: 0 4px 16px rgba(43, 38, 35, 0.28);
          box-sizing: border-box;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: auto;
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
            font-size: 14px;
            line-height: 1;
            flex-shrink: 0;
            pointer-events: none;
          ">
            $[properties.eventEmoji]
          </div>

          <span style="
            font-size: 12px;
            font-weight: 700;
            color: #2B2623;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            letter-spacing: -0.2px;
            pointer-events: none;
          ">
            $[properties.displayTitle]
          </span>

          <span style="
            background: #D95C3C;
            color: #FAF7F2;
            font-size: 9.5px;
            font-weight: 800;
            border-radius: 10px;
            padding: 1.5px 6px;
            pointer-events: none;
          ">
            $[properties.participantsCount]
          </span>
        </div>

        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 7px solid #E2A03F;
          margin: -1px auto 0 auto;
          pointer-events: none;
        "></div>
      </div>`,
      {
        build: function () {
          (this as any).constructor.superclass.build.call(this);
          const el = (this as any).getElement ? (this as any).getElement() : null;
          if (el) {
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';
            const self = this as any;
            const trigger = (e?: any) => {
              if (e && e.stopPropagation) e.stopPropagation();
              const evObj = self.getData()?.properties?.get('eventObj');
              const evId = self.getData()?.properties?.get('eventId');
              if (evObj && (window as any).__ymSelectEventDirect) {
                (window as any).__ymSelectEventDirect(evObj);
              } else if (evId && (window as any).__ymSelectEvent) {
                (window as any).__ymSelectEvent(String(evId));
              }
              const geoObj = self.getData()?.geoObject;
              if (geoObj) {
                geoObj.events.fire('click', { target: geoObj });
              }
            };
            self._clickHandler = trigger;
            el.addEventListener('click', trigger);
            el.addEventListener('touchend', trigger);
          }
        },
        clear: function () {
          const el = (this as any).getElement ? (this as any).getElement() : null;
          if (el && (this as any)._clickHandler) {
            el.removeEventListener('click', (this as any)._clickHandler);
            el.removeEventListener('touchend', (this as any)._clickHandler);
          }
          (this as any).constructor.superclass.clear.call(this);
        }
      }
    );
  }, [ymaps]);

  // 4. Макет кластера людей
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
        pointer-events: auto !important;
      ">
        <span style="font-size: 14px; font-weight: 800; line-height: 1; pointer-events: none;">$[properties.geoObjects.length]</span>
        <span style="font-size: 8px; font-weight: 700; text-transform: uppercase; margin-top: 1px; letter-spacing: 0.5px; opacity: 0.95; pointer-events: none;">чел.</span>
      </div>`
    );
  }, [ymaps]);

  // Исключаем самого запускающего из общего пула, чтобы не было дубля его аватара
  const otherUsers = useMemo(() => {
    const myTgId = Number(currentUser?.telegramId || 0);
    return users.filter((u) => {
      if (!myTgId) return true;
      const uTgId = Number((u as any).telegramId || 0);
      return uTgId !== myTgId;
    });
  }, [users, currentUser]);

  // Разведение координат сходок от людей, чтобы сходка не накладывалась прямо на аватарку
  const eventsWithSeparatedCoords = useMemo(() => {
    const existingPoints: [number, number][] = [];
    if (currentUserCoords) {
      existingPoints.push(currentUserCoords);
    }
    otherUsers.forEach((u) => existingPoints.push(u.displayCoords));

    return events.map((ev, idx) => {
      const rawCoords = ensureLatLng(ev.coordinates);
      const safeCoords = separateCoordinates(rawCoords, existingPoints, idx + 1);
      existingPoints.push(safeCoords);
      return {
        ...ev,
        separatedCoords: safeCoords
      };
    });
  }, [events, otherUsers, currentUserCoords]);

  if (!ymaps || !avatarLayout || !clusterLayout || !eventLayout || !currentUserLayout) {
    return null;
  }

  return (
    <>
      {/* 1. Маркер запускающего приложение ("⭐️ ТЫ") */}
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
            iconShape: ({
              type: 'Rectangle',
              coordinates: [[-27, -68], [27, 0]]
            } as any),
            interactivityModel: 'default#opaque',
            cursor: 'pointer',
            zIndex: 1000,
            hasBalloon: false
          } as any}
          onClick={() => {
            telegramService.haptic('selection');
            if (onSelectCurrentUser) {
              onSelectCurrentUser();
            }
            if (mapInstance && currentUserCoords) {
              mapInstance.panTo(currentUserCoords, { flying: true, duration: 400 });
            }
          }}
        />
      )}

      {/* 2. Кластеризация аватарок остальных участников */}
      <Clusterer
        options={{
          clusterIconLayout: clusterLayout,
          clusterIconOffset: [-22, -22],
          gridSize: 64,
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterOpenBalloonOnClick: false,
          clusterHideIconOnBalloonOpen: false,
          hasBalloon: false
        }}
        onClick={(e: any) => {
          const target = e.get('target');
          if (target && target.properties) {
            const user = target.properties.get('userObj');
            const userId = target.properties.get('userId');
            const found = user || (userId && (window as any).__ymUsersMap?.[String(userId)]);
            if (found) {
              telegramService.haptic('selection');
              onSelectUser(found);
              if (mapInstance && found.displayCoords) {
                mapInstance.panTo(found.displayCoords, { flying: true, duration: 400 });
              }
            }
          }
        }}
      >
        {otherUsers.map((user) => {
          const isSelected = selectedUser?.id === user.id;
          const goalInfo = GOALS_CONFIG[user.goal] || { emoji: '☕️', label: 'Досуг' };
          const coords = ensureLatLng(user.displayCoords);
          const userIdStr = String(user.id || (user as any).telegramId || (user as any)._id || '');

          return (
            <Placemark
              key={`user-${userIdStr || coords.join('-')}`}
              geometry={coords}
              properties={{
                userId: userIdStr,
                userObj: user,
                avatarUrl: user.avatarUrl,
                name: user.firstName,
                goalEmoji: goalInfo.emoji,
                borderColor: isSelected ? '#D95C3C' : '#FAF7F2'
              }}
              options={{
                iconLayout: avatarLayout,
                iconOffset: [-23, -52],
                iconShape: ({
                  type: 'Rectangle',
                  coordinates: [[-23, -52], [23, 0]]
                } as any),
                interactivityModel: 'default#opaque',
                cursor: 'pointer',
                hasBalloon: false
              } as any}
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

      {/* 3. Маркеры событий (Сходок) */}
      {eventsWithSeparatedCoords.map((ev) => {
        const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || { emoji: '⭐️', label: 'Сходка' };
        const rawTitle = ev.title || 'Сходка';
        const displayTitle = rawTitle.length > 14 ? rawTitle.slice(0, 13).trim() + '…' : rawTitle;
        const coords = ev.separatedCoords;
        const eventIdStr = String(ev.id || (ev as any)._id || '');

        return (
          <Placemark
            key={`event-${eventIdStr}-${coords[0]}-${coords[1]}`}
            geometry={coords}
            properties={{
              eventId: eventIdStr,
              eventObj: ev,
              eventEmoji: catConfig.emoji || '⭐️',
              displayTitle,
              fullTitle: rawTitle,
              participantsCount: ev.participantsCount || 1
            }}
            options={{
              iconLayout: eventLayout,
              iconOffset: [-50, -45],
              iconShape: ({
                type: 'Rectangle',
                coordinates: [[-70, -45], [70, 0]]
              } as any),
              interactivityModel: 'default#opaque',
              cursor: 'pointer',
              zIndex: 850,
              hasBalloon: false
            } as any}
            onClick={() => {
              telegramService.haptic('medium');
              if (onSelectEvent) {
                onSelectEvent(ev);
              }
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
  onToggleJoinEvent,
  onUpdateLocation,
  onUpdateUserCoordinates,
  userLocation,
  apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || '',
  applyFuzzyOffset = false
}) => {
  const mapRef = useRef<any>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [cardEvent, setCardEvent] = useState<AppEvent | null>(null);
  const handleUpdate = onUpdateLocation || onUpdateUserCoordinates;

  const lastUserClickTs = useRef<number>(0);
  const lastEventClickTs = useRef<number>(0);

  // Хранилище быстрого доступа для мгновенного резолва по ID
  useEffect(() => {
    const usersMap: Record<string, UserProfile> = {};
    users.forEach((u: UserProfile) => {
      if (u.id) usersMap[String(u.id)] = u;
      if ((u as any).telegramId) usersMap[String((u as any).telegramId)] = u;
      if ((u as any)._id) usersMap[String((u as any)._id)] = u;
    });
    (window as any).__ymUsersMap = usersMap;

    const eventsMap: Record<string, AppEvent> = {};
    events.forEach((ev: AppEvent) => {
      if (ev.id) eventsMap[String(ev.id)] = ev;
      if ((ev as any)._id) eventsMap[String((ev as any)._id)] = ev;
    });
    (window as any).__ymEventsMap = eventsMap;

    return () => {
      delete (window as any).__ymUsersMap;
      delete (window as any).__ymEventsMap;
    };
  }, [users, events]);

  // Восстановление сохраненных координат из localStorage
  const [currentCoords, setCurrentCoords] = useState<[number, number]>(() => {
    try {
      const saved = localStorage.getItem('yesminsk_user_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return ensureLatLng(parsed);
        }
      }
    } catch (e) {}

    if (currentUser?.coordinates) return ensureLatLng(currentUser.coordinates);
    if (userLocation) return ensureLatLng(userLocation);
    return MINSK_CENTER;
  });

  // Глобальные мостовые слушатели для гарантированного открытия шторки при клике на карте
  useEffect(() => {
    (window as any).__ymSelectUser = (userId: string) => {
      const now = Date.now();
      if (now - lastUserClickTs.current < 250) return;
      lastUserClickTs.current = now;

      const found =
        (window as any).__ymUsersMap?.[String(userId)] ||
        users.find(
          (u: UserProfile) =>
            String(u.id) === String(userId) ||
            String((u as any).telegramId) === String(userId) ||
            String((u as any)._id) === String(userId)
        );

      if (found) {
        telegramService.haptic('selection');
        setCardEvent(null);
        onSelectUser(found);
        if (mapRef.current && found.coordinates) {
          mapRef.current.panTo(ensureLatLng(found.coordinates), { flying: true, duration: 400 });
        }
      }
    };

    (window as any).__ymSelectCurrentUser = () => {
      const now = Date.now();
      if (now - lastUserClickTs.current < 250) return;
      lastUserClickTs.current = now;

      telegramService.haptic('selection');
      setCardEvent(null);
      if (onSelectCurrentUser) {
        onSelectCurrentUser();
      }
      if (mapRef.current && currentCoords) {
        mapRef.current.panTo(currentCoords, { flying: true, duration: 400 });
      }
    };

    (window as any).__ymSelectEvent = (eventId: string) => {
      const now = Date.now();
      if (now - lastEventClickTs.current < 250) return;
      lastEventClickTs.current = now;

      const found =
        (window as any).__ymEventsMap?.[String(eventId)] ||
        events.find(
          (e: AppEvent) => String(e.id) === String(eventId) || String((e as any)._id) === String(eventId)
        );

      if (found) {
        telegramService.haptic('medium');
        if (onSelectEvent) {
          onSelectEvent(found);
        } else {
          setCardEvent(found);
        }
        if (mapRef.current && found.coordinates) {
          mapRef.current.panTo(ensureLatLng(found.coordinates), { flying: true, duration: 400 });
        }
      }
    };

    return () => {
      delete (window as any).__ymSelectUser;
      delete (window as any).__ymSelectCurrentUser;
      delete (window as any).__ymSelectEvent;
    };
  }, [users, events, onSelectUser, onSelectCurrentUser, onSelectEvent, currentCoords]);

  // Обновление локальных координат при внешнем изменении
  useEffect(() => {
    if (currentUser?.coordinates) {
      const fresh = ensureLatLng(currentUser.coordinates);
      setCurrentCoords((prev) => {
        if (Math.abs(prev[0] - fresh[0]) < 0.0001 && Math.abs(prev[1] - fresh[1]) < 0.0001) {
          return prev;
        }
        return fresh;
      });
    }
  }, [currentUser?.coordinates]);

  const usersWithSafeCoords = useMemo(() => {
    return users.map((user) => {
      const coords = ensureLatLng(user.coordinates);
      const displayCoords: [number, number] = applyFuzzyOffset
        ? obfuscateCoordinates(coords[0], coords[1])
        : coords;

      return {
        ...user,
        displayCoords
      };
    });
  }, [users, applyFuzzyOffset]);

  const handleEventClick = (ev: AppEvent) => {
    if (onSelectEvent) {
      onSelectEvent(ev);
    } else {
      setCardEvent(ev);
    }
  };

  const handleLocateGPS = () => {
    telegramService.haptic('light');

    if (!navigator.geolocation) {
      if (mapRef.current) {
        mapRef.current.panTo(currentCoords, { flying: true, duration: 500 });
      }
      return;
    }

    setIsGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const isInMinsk = lat >= 53.75 && lat <= 54.05 && lng >= 27.35 && lng <= 27.80;

        if (!isInMinsk) {
          alert('GPS указывает за пределы Минска (возможно, включен VPN). Центрируем по текущей точке.');
          if (mapRef.current) {
            mapRef.current.panTo(currentCoords, { flying: true, duration: 500 });
          }
          return;
        }

        telegramService.haptic('success');
        const newCoords: [number, number] = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];

        // 1. Фиксируем в localStorage, чтобы гео-позиция сохранялась при любых переключениях
        try {
          localStorage.setItem('yesminsk_user_coords', JSON.stringify(newCoords));
        } catch (e) {}

        // 2. Моментально переносим маркер «⭐️ ТЫ»
        setCurrentCoords(newCoords);

        // 3. Плавно перемещаем камеру карты прямо на пользователя
        if (mapRef.current) {
          mapRef.current.panTo(newCoords, { flying: true, duration: 500 });
        }

        // 4. Передаем наверх для синхронизации с базой данных
        if (handleUpdate) {
          handleUpdate(newCoords);
        }
      },
      (err) => {
        setIsGpsLoading(false);
        console.warn('GPS error in map:', err);
        if (mapRef.current) {
          mapRef.current.panTo(currentCoords, { flying: true, duration: 500 });
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
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
            center: currentCoords,
            zoom: 13,
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
            events={events}
            currentUser={currentUser}
            currentUserCoords={currentCoords}
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

      {/* Автономная карточка сходки (если MinskMap используется отдельно) */}
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
            {onToggleJoinEvent ? (
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
            ) : (
              <div className="text-[11px] font-semibold text-zinc-700">
                👥 {cardEvent.participantsCount || 1} участников
              </div>
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
