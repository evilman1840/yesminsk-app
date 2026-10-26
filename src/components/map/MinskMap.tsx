import React, { useRef, useMemo, useState, useEffect } from 'react';
import { thumb } from '../../utils/thumb';
import { Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import { LocateFixed } from 'lucide-react';
import { UserProfile, AppEvent, ActivityGoal, GOALS_CONFIG, EVENT_CATEGORIES_CONFIG, eventCategoryOf, isAvailableNow, isVentingNow, PlaceItem, PLACE_MOODS } from '../../types';
import { serverUrl } from '../../services/api';
import { BottomSheet } from '../ui/BottomSheet';
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
  places?: PlaceItem[];
  onSelectPlace?: (place: PlaceItem) => void;
  onUpdateLocation?: (coords: [number, number]) => void;
  onUpdateUserCoordinates?: (coords: [number, number]) => void;
  userLocation?: [number, number];
  apiKey?: string;
  applyFuzzyOffset?: boolean;
  shownCoords?: [number, number] | null; // где тебя видят другие: «Ты» стоит там же
  picking?: boolean;                     // режим «Сдвинуть метку»: булавка в центре карты
  pickHint?: React.ReactNode;            // панель снизу в этом режиме, получает центр карты
  onPickCenter?: (getCenter: () => [number, number] | null) => void;
}

const MINSK_CENTER: [number, number] = [53.9045, 27.5615];
// Минск в пределах МКАД — так карта открывается по умолчанию
const MINSK_BOUNDS: [[number, number], [number, number]] = [[53.835, 27.405], [53.975, 27.705]];

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
  minMeters: number = 500,
  maxMeters: number = 800
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

// Короткая дата для метки сходки: «сегодня · 18:00», «завтра · 12:00» или «сб, 25 окт · 18:00»
const formatMarkerDate = (iso: string) => {
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    const dayDiff = Math.round(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000
    );
    if (dayDiff === 0) return `сегодня · ${time}`;
    if (dayDiff === 1) return `завтра · ${time}`;
    const day = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
    return `${day} · ${time}`;
  } catch {
    return '';
  }
};

// Заглушка для места без фото: бежевый квадрат с эмодзи
const placePlaceholder = (emoji: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#F4EFEA"/><text x="32" y="44" font-size="30" text-anchor="middle">${emoji}</text></svg>`
  )}`;

// Что лежит в группе меток, которые стоят почти в одной точке
type ClusterItem = { kind: 'user'; user: UserProfile } | { kind: 'event'; event: AppEvent } | { kind: 'place'; place: PlaceItem };

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
  isZoomedIn: boolean;
  onClusterItems?: (items: ClusterItem[]) => void;
  places: PlaceItem[];
  onSelectPlace?: (place: PlaceItem) => void;
}> = ({
  users,
  events,
  places,
  onSelectPlace,
  isZoomedIn,
  onClusterItems,
  currentUser,
  selectedUser,
  onSelectUser,
  onSelectCurrentUser,
  onSelectEvent,
  mapInstance,
  currentUserCoords
}) => {
  const ymapsHook = useYMaps(['templateLayoutFactory']);
  const ymaps = ymapsHook || (typeof window !== 'undefined' ? (window as any).ymaps : null);

  // 1. Макет круглой аватарки других людей
  const avatarLayout = useMemo(() => {
    if (!ymaps) return null;
    return (ymaps as any).templateLayoutFactory.createClass(
      `<div class="ymaps-avatar-marker" style="position: relative; width: 46px; height: 52px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;">
        <div style="width: 46px; height: 46px; border-radius: 50%; padding: 2px; background-color: #FAF7F2; border: 2.5px solid $[properties.borderColor]; box-shadow: 0 4px 14px rgba(43, 38, 35, 0.22); position: relative; box-sizing: border-box;">
          <img src="$[properties.avatarUrl]" alt="$[properties.name]" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; pointer-events: none;" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'" />
          <span style="position: absolute; bottom: -3px; right: -3px; background: #FFFFFF; font-size: 13px; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border: 1px solid #E8DFD5; box-shadow: 0 1px 3px rgba(0,0,0,0.12); pointer-events: none;">
            $[properties.goalEmoji]
          </span>
          <span style="position: absolute; top: -4px; left: -4px; background: #FFFFFF; font-size: 11px; border-radius: 50%; width: 19px; height: 19px; display: $[properties.empathDisplay]; align-items: center; justify-content: center; border: 1px solid #E8DFD5; box-shadow: 0 1px 3px rgba(0,0,0,0.12); pointer-events: none;">🫶</span>
          <span style="position: absolute; top: -4px; right: -4px; background: #FBE3E6; font-size: 11px; border-radius: 50%; width: 19px; height: 19px; display: $[properties.ventDisplay]; align-items: center; justify-content: center; border: 1px solid #E8C4CA; box-shadow: 0 1px 3px rgba(0,0,0,0.12); pointer-events: none;">🫂</span>
        </div>
        <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid $[properties.borderColor]; margin: -1px auto 0 auto; pointer-events: none;"></div>
      </div>`
    );
  }, [ymaps]);

  // 2. Макет аватарки ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ("⭐️ ТЫ")
  const currentUserLayout = useMemo(() => {
    if (!ymaps) return null;
    return (ymaps as any).templateLayoutFactory.createClass(
      `<div class="ymaps-current-user-marker" style="position: relative; width: 54px; height: 76px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;">
        <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); background: #D95C3C; color: #FAF7F2; font-size: 13px; font-weight: 800; padding: 2px 10px; border-radius: 12px; border: 2px solid #FFFDF9; box-shadow: 0 2px 6px rgba(0,0,0,0.3); white-space: nowrap; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; z-index: 10; pointer-events: none;">
          Ты
        </div>
        <div style="margin-top: 16px; width: 52px; height: 52px; border-radius: 50%; padding: 2.5px; background-color: #FAF7F2; border: 3.5px solid #D95C3C; box-shadow: 0 0 0 3px rgba(217, 92, 60, 0.4), 0 8px 22px rgba(43, 38, 35, 0.35); position: relative; box-sizing: border-box;">
          <img src="$[properties.avatarUrl]" alt="$[properties.name]" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; pointer-events: none;" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'" />
          <span style="position: absolute; bottom: -3px; right: -3px; background: #FAF7F2; font-size: 12px; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #D95C3C; box-shadow: 0 1px 4px rgba(0,0,0,0.15); pointer-events: none;">
            $[properties.goalEmoji]
          </span>
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #D95C3C; margin: -1px auto 0 auto; pointer-events: none;"></div>
      </div>`
    );
  }, [ymaps]);

  // 3. Макет маркера СХОДКИ: крупное название и время, «хвостик» указывает на место встречи
  const eventLayout = useMemo(() => {
    if (!ymaps) return null;
    return (ymaps as any).templateLayoutFactory.createClass(
      `<div class="ymaps-event-marker" style="position: relative; display: inline-flex; flex-direction: column; align-items: flex-start; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="display: inline-flex; align-items: center; gap: 8px; height: 56px; padding: 6px 12px 6px 6px; border-radius: 28px; background: #FFFDF9; border: 2.5px solid $[properties.accent]; box-shadow: 0 6px 18px rgba(43, 38, 35, 0.3); box-sizing: border-box; white-space: nowrap;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: $[properties.accent]; display: flex; align-items: center; justify-content: center; font-size: 20px; line-height: 1; flex-shrink: 0; pointer-events: none;">
            $[properties.eventEmoji]
          </div>
          <div style="display: flex; flex-direction: column; min-width: 0; pointer-events: none;">
            <span style="font-size: 15px; font-weight: 800; line-height: 19px; color: #2B2623; max-width: 170px; overflow: hidden; text-overflow: ellipsis;">$[properties.displayTitle]</span>
            <span style="font-size: 13px; font-weight: 600; line-height: 17px; color: #B5462A;">$[properties.displayWhen] · 👥 $[properties.participantsCount]</span>
          </div>
        </div>
        <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid $[properties.accent]; margin: -1px 0 0 20px; pointer-events: none;"></div>
      </div>`
    );
  }, [ymaps]);

  // 3а. Компактная сходка (карта отдалена): кружок с эмодзи и числом участников
  const eventCompactLayout = useMemo(() => {
    if (!ymaps) return null;
    return (ymaps as any).templateLayoutFactory.createClass(
      `<div style="position: relative; width: 52px; height: 60px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;">
        <div style="width: 52px; height: 52px; border-radius: 50%; background: #FFFDF9; border: 3px solid $[properties.accent]; box-shadow: 0 6px 16px rgba(43, 38, 35, 0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; box-sizing: border-box;">$[properties.eventEmoji]</div>
        <span style="position: absolute; top: -4px; right: -6px; min-width: 22px; height: 22px; padding: 0 5px; border-radius: 11px; background: $[properties.accent]; color: #FFFFFF; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid #FFFDF9; box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">$[properties.participantsCount]</span>
        <div style="width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 8px solid $[properties.accent]; margin: -1px auto 0 auto;"></div>
      </div>`
    );
  }, [ymaps]);

  // 3б. Макет МЕСТА: фото в скруглённом квадрате и эмодзи настроения
  const placeLayout = useMemo(() => {
    if (!ymaps) return null;
    return (ymaps as any).templateLayoutFactory.createClass(
      `<div style="position: relative; width: 58px; height: 66px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;">
        <div style="width: 58px; height: 58px; border-radius: 16px; padding: 3px; background: #FFFDF9; box-shadow: 0 6px 16px rgba(43, 38, 35, 0.3); box-sizing: border-box; border: 2.5px solid #5B7B68;">
          <img src="$[properties.photo]" alt="" style="width: 100%; height: 100%; border-radius: 11px; object-fit: cover; display: block; pointer-events: none; background: #E8DFD5;" />
          <span style="position: absolute; top: -6px; right: -6px; width: 26px; height: 26px; border-radius: 50%; background: #FFFDF9; border: 2px solid #5B7B68; display: flex; align-items: center; justify-content: center; font-size: 14px; pointer-events: none;">$[properties.emoji]</span>
        </div>
        <div style="width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 8px solid #5B7B68; margin: -1px auto 0 auto; pointer-events: none;"></div>
      </div>`
    );
  }, [ymaps]);

  // 4. Макет кластера людей (несколько человек рядом)
  const clusterLayout = useMemo(() => {
    if (!ymaps) return null;
    return (ymaps as any).templateLayoutFactory.createClass(
      `<div style="width: 52px; height: 52px; border-radius: 50%; background-color: #D95C3C; border: 3px solid #FFFDF9; color: #FFFFFF; display: flex; align-items: center; justify-content: center; gap: 2px; box-shadow: 0 4px 14px rgba(217, 92, 60, 0.45); font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; cursor: pointer; user-select: none;">
        <span style="font-size: 18px; font-weight: 800; line-height: 1; pointer-events: none;">$[properties.geoObjects.length]</span>
      </div>`
    );
  }, [ymaps]);

  // Исключаем самого запускающего из общего пула, чтобы не было дубля его аватара
  const otherUsers = useMemo(() => {
    const myTgId = Number(currentUser?.telegramId || 0);
    return users.filter((u: UserProfile) => {
      if (!myTgId) return true;
      const uTgId = Number((u as any).telegramId || 0);
      return uTgId !== myTgId;
    });
  }, [users, currentUser]);

  // Разведение координат сходок от людей
  const eventsWithSeparatedCoords = useMemo(() => {
    const existingPoints: [number, number][] = [];
    if (currentUserCoords) existingPoints.push(currentUserCoords);
    otherUsers.forEach((u: UserProfile & { displayCoords: [number, number] }) => existingPoints.push(u.displayCoords));

    return events.map((ev: AppEvent, idx: number) => {
      const rawCoords = ensureLatLng(ev.coordinates);
      const safeCoords = separateCoordinates(rawCoords, existingPoints, idx + 1);
      existingPoints.push(safeCoords);
      return { ...ev, separatedCoords: safeCoords };
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
            avatarUrl: thumb(currentUser.avatarUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            name: currentUser.name || currentUser.firstName || 'Ты',
            goalEmoji: (GOALS_CONFIG[currentUser.goal || 'walk'] || { emoji: '☕️' }).emoji
          }}
          options={{
            iconLayout: currentUserLayout,
            iconOffset: [-27, -76],
            iconShape: { type: 'Rectangle', coordinates: [[0, 0], [54, 76]] } as any,
            interactivityModel: 'default#opaque',
            cursor: 'pointer',
            zIndex: 1000,
            hasBalloon: false
          } as any}
          onClick={() => {
            telegramService.haptic('selection');
            if (onSelectCurrentUser) onSelectCurrentUser();
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
          clusterIconOffset: [-26, -26],
          clusterIconShape: { type: 'Circle', coordinates: [26, 26], radius: 28 } as any,
          gridSize: 64,
          groupByCoordinates: false,
          clusterDisableClickZoom: true, // приближаем сами — аккуратнее
          clusterOpenBalloonOnClick: false,
          clusterHideIconOnBalloonOpen: false,
          hasBalloon: false
        } as any}
        onClick={(e: any) => {
          const target = e.get('target');
          if (!target) return;

          const clustered = typeof target.getGeoObjects === 'function' ? target.getGeoObjects() : null;

          // Обработка клика по самому кластеру (группе)
          if (clustered && Array.isArray(clustered)) {
            if (clustered.length > 1) {
              telegramService.haptic('selection');
              const bounds = typeof target.getBounds === 'function' ? target.getBounds() : null;
              const span = bounds ? Math.max(Math.abs(bounds[1][0] - bounds[0][0]), Math.abs(bounds[1][1] - bounds[0][1])) : 0;
              // Метки почти в одной точке (< ~60 м) — приближать бесполезно, показываем список
              if (!bounds || span < 0.0006 || (mapInstance && mapInstance.getZoom() >= 17)) {
                const items: ClusterItem[] = clustered
                  .map((obj: any): ClusterItem | null => {
                    const p = obj.properties;
                    const ev = p.get('eventId') ? events.find((x) => String(x.id) === String(p.get('eventId'))) : null;
                    if (ev) return { kind: 'event', event: ev };
                    const pl = p.get('placeId') ? places.find((x) => x.id === p.get('placeId')) : null;
                    if (pl) return { kind: 'place', place: pl };
                    const u = users.find((x) => String(x.id || (x as any).telegramId) === String(p.get('userId')));
                    return u ? { kind: 'user', user: u } : null;
                  })
                  .filter(Boolean) as ClusterItem[];
                onClusterItems?.(items);
                return;
              }
              if (mapInstance) {
                mapInstance.setBounds(bounds, { checkZoomRange: true, zoomMargin: 90, duration: 300 }).then(() => {
                  if (mapInstance.getZoom() > 17) mapInstance.setZoom(17, { duration: 200 });
                });
              }
              return;
            } else if (clustered.length === 1) {
              const props = clustered[0]?.properties;
              const evId = props?.get('eventId');
              const plId = props?.get('placeId');
              if (evId) {
                const ev = events.find((x) => String(x.id) === String(evId));
                if (ev) onSelectEvent?.(ev);
                return;
              }
              if (plId) {
                const pl = places.find((x) => x.id === plId);
                if (pl) onSelectPlace?.(pl);
                return;
              }
              const userId = props?.get('userId');
              const found = users.find((u: UserProfile) => String(u.id || (u as any).telegramId || (u as any)._id) === String(userId));
              if (found) {
                telegramService.haptic('selection');
                onSelectUser(found);
                if (mapInstance && found.displayCoords) mapInstance.panTo(found.displayCoords, { flying: true, duration: 400 });
              }
              return;
            }
          }

          // Обработка клика по одиночному маркеру
          const userId = target.properties?.get('userId');
          if (userId) {
            const found = users.find((u: UserProfile) => String(u.id || (u as any).telegramId || (u as any)._id) === String(userId));
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
        {otherUsers.map((user: UserProfile & { displayCoords: [number, number] }, idx: number) => {
          const isSelected = selectedUser?.id === user.id;
          const goalInfo = GOALS_CONFIG[user.goal] || { emoji: '☕️', label: 'Досуг' };
          const available = isAvailableNow(user);
          const coords = ensureLatLng(user.displayCoords);
          const userIdStr = String(user.id || (user as any).telegramId || (user as any)._id || '');

          return (
            <Placemark
              key={`user-${userIdStr || `idx-${idx}`}-${coords[0]}-${coords[1]}`}
              geometry={coords}
              properties={{
                userId: userIdStr,
                avatarUrl: thumb(user.avatarUrl),
                name: user.firstName,
                // «⚡ Свободен сейчас» — зелёная обводка и молния вместо значка цели
                goalEmoji: available ? '⚡' : user.isGuide ? '🧭' : goalInfo.emoji,
                // Маленькие значки сверху: 🫶 эмпат, 🫂 «хочется поныть» (видят только эмпаты)
                empathDisplay: user.isEmpath ? 'flex' : 'none',
                ventDisplay: isVentingNow(user) ? 'flex' : 'none',
                borderColor: isSelected ? '#D95C3C' : available ? '#2FA36B' : '#FAF7F2'
              }}
              options={{
                iconLayout: avatarLayout,
                iconOffset: [-23, -52],
                iconShape: { type: 'Rectangle', coordinates: [[0, 0], [46, 58]] } as any,
                interactivityModel: 'default#opaque',
                cursor: 'pointer',
                hasBalloon: false
              } as any}
              onClick={() => {
                telegramService.haptic('selection');
                onSelectUser(user);
                if (mapInstance) mapInstance.panTo(coords, { flying: true, duration: 400 });
              }}
            />
          );
        })}

        {/* Места и сходки — в той же группировке: близкие метки сливаются в кружок с числом */}
        {/* Места по вайбу */}
        {placeLayout &&
          places.map((place) => (
            <Placemark
              key={`place-${place.id}`}
              geometry={place.coordinates}
              properties={{
                placeId: place.id,
                photo: place.photos[0] ? serverUrl(place.photos[0]) : placePlaceholder(PLACE_MOODS[place.moods[0]]?.emoji || '📍'),
                emoji: PLACE_MOODS[place.moods[0]]?.emoji || '📍'
              }}
              options={{
                iconLayout: placeLayout,
                iconOffset: [-29, -66],
                iconShape: { type: 'Rectangle', coordinates: [[0, 0], [58, 66]] } as any,
                interactivityModel: 'default#opaque',
                cursor: 'pointer',
                zIndex: 900,
                hasBalloon: false
              } as any}
              onClick={() => {
                telegramService.haptic('selection');
                onSelectPlace?.(place);
                if (mapInstance) mapInstance.panTo(place.coordinates, { flying: true, duration: 400 });
              }}
            />
          ))}

        {/* 3. Маркеры событий (Сходок) */}
        {eventsWithSeparatedCoords.map((ev: AppEvent & { separatedCoords: [number, number] }) => {
          const catConfig = eventCategoryOf(ev);
          const rawTitle = ev.title || 'Сходка';
          const displayTitle = rawTitle.length > 20 ? rawTitle.slice(0, 19).trim() + '…' : rawTitle;
          const displayWhen = formatMarkerDate(ev.dateTime);
          const coords = ev.separatedCoords;
          const eventIdStr = String(ev.id || (ev as any)._id || '');

          return (
            <Placemark
              key={`event-${eventIdStr}-${coords[0]}-${coords[1]}-${isZoomedIn ? 'big' : 'small'}`}
              geometry={coords}
              properties={{
                eventId: eventIdStr,
                eventEmoji: catConfig.emoji || '⭐️',
                // Официальные сходки ГУЛЯЙ! — терракотовые, остальные — горчичные
                accent: ev.isOfficial ? '#D95C3C' : '#E2A03F',
                displayTitle,
                displayWhen,
                participantsCount: ev.participantsCount || 1
              }}
              options={{
                // Подпись с названием — только когда карту приблизили, иначе компактный кружок
                iconLayout: isZoomedIn ? eventLayout : eventCompactLayout,
                iconOffset: isZoomedIn ? [-28, -66] : [-26, -60],
                iconShape: { type: 'Rectangle', coordinates: isZoomedIn ? [[0, 0], [240, 66]] : [[0, 0], [52, 60]] } as any,
                interactivityModel: 'default#opaque',
                cursor: 'pointer',
                zIndex: 1100,
                hasBalloon: false
              } as any}
              onClick={() => {
                telegramService.haptic('medium');
                if (onSelectEvent) onSelectEvent(ev);
                if (mapInstance) mapInstance.panTo(coords, { flying: true, duration: 400 });
              }}
            />
          );
        })}
      </Clusterer>

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
  applyFuzzyOffset = false,
  places = [],
  onSelectPlace,
  shownCoords,
  picking = false,
  pickHint,
  onPickCenter
}) => {
  const mapRef = useRef<any>(null);
  // Приближена ли карта — от этого зависит размер меток сходок
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  // Экземпляр карты в состоянии — чтобы метки получили его после загрузки и могли приближать карту
  const [mapInstance, setMapInstance] = useState<any>(null);
  // Список «Здесь несколько» для меток в одной точке
  const [clusterItems, setClusterItems] = useState<ClusterItem[] | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const handleUpdate = onUpdateLocation || onUpdateUserCoordinates;

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

  // Обновление локальных координат при внешнем изменении
  useEffect(() => {
    if (currentUser?.coordinates) {
      const fresh = ensureLatLng(currentUser.coordinates);
      setCurrentCoords((prev: [number, number]) => {
        if (Math.abs(prev[0] - fresh[0]) < 0.0001 && Math.abs(prev[1] - fresh[1]) < 0.0001) return prev;
        return fresh;
      });
    }
  }, [currentUser?.coordinates]);

  const usersWithSafeCoords = useMemo(() => {
    return users.map((user: UserProfile) => {
      const coords = ensureLatLng(user.coordinates);
      const displayCoords: [number, number] = applyFuzzyOffset
        ? obfuscateCoordinates(coords[0], coords[1])
        : coords;

      return { ...user, displayCoords };
    });
  }, [users, applyFuzzyOffset]);

  // Режим «Сдвинуть метку»: приближаем к текущей метке и отдаём наружу, как узнать центр карты
  useEffect(() => {
    if (!picking) return;
    const start = shownCoords ? ensureLatLng(shownCoords) : currentCoords;
    mapRef.current?.setCenter(start, 15, { duration: 300 });
    onPickCenter?.(() => {
      const c = mapRef.current?.getCenter();
      return c ? [Number(c[0].toFixed(6)), Number(c[1].toFixed(6))] : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking]);

  const handleEventClick = (ev: AppEvent) => {
    onSelectEvent?.(ev);
  };

  const handleLocateGPS = () => {
    telegramService.haptic('light');

    if (!navigator.geolocation) {
      if (mapRef.current) mapRef.current.panTo(currentCoords, { flying: true, duration: 500 });
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
          telegramService.alert('GPS указывает за пределы Минска (возможно, включен VPN). Центрируем по текущей точке.', 'info');
          if (mapRef.current) mapRef.current.panTo(currentCoords, { flying: true, duration: 500 });
          return;
        }

        telegramService.haptic('success');
        const newCoords: [number, number] = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];

        try { localStorage.setItem('yesminsk_user_coords', JSON.stringify(newCoords)); } catch (e) {}
        setCurrentCoords(newCoords);

        if (mapRef.current) mapRef.current.panTo(newCoords, { flying: true, duration: 500 });
        if (handleUpdate) handleUpdate(newCoords);
      },
      (err) => {
        setIsGpsLoading(false);
        console.warn('GPS error in map:', err);
        if (mapRef.current) mapRef.current.panTo(currentCoords, { flying: true, duration: 500 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-zine-paper">
      <style>{`
        .ymaps-2-1-79-ground-pane,
        [class*="ground-pane"] { filter: sepia(20%) brightness(99%) contrast(94%) hue-rotate(-8deg) !important; }
        .ymaps-2-1-79-inner-panes { background-color: #F4EFE7 !important; }
        html.dark [class*="ground-pane"] { filter: invert(92%) hue-rotate(180deg) brightness(95%) contrast(88%) sepia(12%) !important; }
        html.dark .ymaps-2-1-79-inner-panes { background-color: #1C1917 !important; }
      `}</style>

      <Map
        defaultState={{ center: MINSK_CENTER, zoom: 11, controls: [] }}
        options={{ suppressMapOpenBlock: true }}
        className="w-full h-full"
        instanceRef={(ref: any) => {
          if (ref && mapRef.current !== ref) {
            mapRef.current = ref;
            // Сразу весь Минск (в пределах МКАД) — чтобы была видна активность по всему городу.
            // Отступы — под шапку сверху и кнопки снизу
            ref.setBounds(MINSK_BOUNDS, { checkZoomRange: true, preciseZoom: true, zoomMargin: [170, 0, 110, 0] }).catch?.(() => {});
            setMapInstance(ref);
            setIsZoomedIn(ref.getZoom() >= 15);
            ref.events.add('boundschange', (e: any) => setIsZoomedIn(e.get('newZoom') >= 15));
          }
        }}
      >
        <MinskMapContent
          users={usersWithSafeCoords}
          events={events}
          currentUser={currentUser}
          currentUserCoords={picking ? null : shownCoords ? ensureLatLng(shownCoords) : currentCoords}
          selectedUser={selectedUser}
          onSelectUser={onSelectUser}
          onSelectCurrentUser={onSelectCurrentUser}
          onSelectEvent={handleEventClick}
          mapInstance={mapInstance}
          places={places}
          onSelectPlace={onSelectPlace}
          isZoomedIn={isZoomedIn}
          onClusterItems={setClusterItems}
        />
      </Map>

      {clusterItems && (
        <BottomSheet title={`Здесь ${clusterItems.length}`} onClose={() => setClusterItems(null)}>
          <div className="space-y-2">
            {clusterItems.map((item, i) => {
              const pick = () => {
                setClusterItems(null);
                telegramService.haptic('selection');
                if (item.kind === 'user') onSelectUser(item.user);
                if (item.kind === 'event') onSelectEvent?.(item.event);
                if (item.kind === 'place') onSelectPlace?.(item.place);
              };
              const [img, emoji, title, subtitle] =
                item.kind === 'user'
                  ? [thumb(item.user.avatarUrl), '', item.user.firstName, 'Человек рядом']
                  : item.kind === 'event'
                  ? ['', EVENT_CATEGORIES_CONFIG[item.event.category]?.emoji || '📍', item.event.title, 'Сходка']
                  : [item.place.photos[0] ? serverUrl(item.place.photos[0]) : '', PLACE_MOODS[item.place.moods[0]]?.emoji || '📍', item.place.name, 'Место'];
              return (
                <button key={i} onClick={pick} className="w-full p-3 rounded-zine-sm bg-zine-card flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform">
                  {img ? (
                    <img src={img} alt="" className={`w-12 h-12 object-cover shrink-0 ${item.kind === 'user' ? 'rounded-full' : 'rounded-zine-sm'}`} />
                  ) : (
                    <span className="w-12 h-12 shrink-0 rounded-zine-sm bg-zine-cardElevated flex items-center justify-center text-[24px]">{emoji}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-body font-bold text-zine-ink truncate">{title}</span>
                    <span className="block text-sm2 text-zine-inkMuted">{subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* «Сдвинуть метку»: двигаешь карту, булавка в центре — там тебя и увидят */}
      {picking && (
        <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full z-30 pointer-events-none flex flex-col items-center">
            <div className="px-3 py-1 rounded-full bg-zine-terracotta text-white text-sm2 font-bold shadow-zine-float whitespace-nowrap">Тебя увидят здесь</div>
            <div className="mt-1 w-12 h-12 rounded-full border-[3px] border-zine-terracotta bg-zine-cardElevated overflow-hidden shadow-zine-float">
              {currentUser?.avatarUrl && <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="w-0 h-0 border-x-[7px] border-x-transparent border-t-[9px] border-t-zine-terracotta" />
          </div>
          {pickHint}
        </>
      )}

      {/* Кнопка "Где я?" (GPS) */}
      {!picking && <button
        onClick={handleLocateGPS}
        disabled={isGpsLoading}
        className="absolute right-4 bottom-14 w-14 h-14 rounded-full bg-zine-cardElevated border border-zine-border shadow-zine-float flex items-center justify-center text-zine-terracotta z-20 active:scale-90 transition-transform cursor-pointer"
        title="Где я?"
        aria-label="Показать, где я"
      >
        <LocateFixed size={26} className={isGpsLoading ? 'animate-spin' : ''} />
      </button>}
    </div>
  );
};

export default MinskMap;
