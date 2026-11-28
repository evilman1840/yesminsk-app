import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { thumb, NO_PHOTO } from '../../utils/thumb';
import { Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import type { IProjection, MapEvent, Map as YandexMap } from 'yandex-maps';
import { MapQuickControls } from './MapControls';
import { UserProfile, AppEvent, LiveStatus, EVENT_CATEGORIES_CONFIG, eventCategoryOf, isAvailableNow, PlaceItem, PLACE_MOODS } from '../../types';
import { serverUrl } from '../../services/api';
import { BottomSheet } from '../ui/BottomSheet';
import { telegramService } from '../../services/telegram';
import { currentLiveStatus, useLiveStatus, useLiveStatusExpiry } from '../common/LiveStatus';
import { shortOffer, upperFirst } from '../../texts/liveStatus';
import { STATUS_NOTE_REACH, STATUS_NOTE_WIDTH, visibleStatusPins, type StatusSide } from './visibleStatusPins';
import { track } from '../../analytics/runtime';

const NO_FEATURED_PINS: ReadonlyMap<string, StatusSide> = new globalThis.Map();
const mapUserId = (user: UserProfile) => String(user.id || user.telegramId || (user as any)._id || '');

export interface MinskMapProps {
  users: UserProfile[];
  events?: AppEvent[];
  currentUser?: {
    telegramId?: number;
    name?: string;
    firstName?: string;
    username?: string;
    avatarUrl?: string;
    liveStatus?: LiveStatus | null;
    area?: string;
    coordinates?: [number, number];
    bio?: string;
    age?: string | number;
  } | null;
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectCurrentUser?: () => void;
  onOpenDonate?: () => void;
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
  statusTopInset?: number;
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

const statusBadgeMarkup = `<span data-live-status data-side="right" class="group/status pointer-events-none absolute hidden w-max max-w-[132px] rounded-2xl border border-zine-border bg-zine-cardElevated px-2.5 py-1.5 text-zine-ink shadow-zine-sm">
  <span aria-hidden="true" class="absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-zine-cardElevated group-data-[side=right]/status:-left-1 group-data-[side=right]/status:border-b group-data-[side=right]/status:border-l group-data-[side=left]/status:-right-1 group-data-[side=left]/status:border-r group-data-[side=left]/status:border-t border-zine-border"></span>
  <span data-want class="relative hidden truncate text-xs font-semibold leading-tight"></span>
  <span data-offer class="relative hidden truncate text-[11px] font-normal leading-tight text-zine-inkMuted"></span>
</span>`;

function fillStatusBadge(root: HTMLElement | null, want: string, offer: string) {
  const badge = root?.querySelector<HTMLElement>('[data-live-status]');
  if (!badge || (!want && !offer)) return null;
  badge.style.display = 'block';
  // User phrases are text, including when the map template is rebuilt.
  for (const [key, phrase] of [['want', want], ['offer', offer]] as const) {
    const row = badge.querySelector<HTMLElement>(`[data-${key}]`)!;
    row.style.display = phrase ? 'block' : 'none';
    row.textContent = phrase;
  }
  return badge;
}

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
  mapInstance: YandexMap | null;
  picking: boolean;
  statusTopInset: number;
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
  picking,
  statusTopInset,
  currentUserCoords
}) => {
  const ymapsHook = useYMaps(['templateLayoutFactory']);
  const ymaps = ymapsHook || (typeof window !== 'undefined' ? (window as any).ymaps : null);
  const statusBubbles = useRef(new globalThis.Map<string, HTMLElement>());

  // 1. Макет круглой аватарки других людей
  const avatarLayout = useMemo(() => {
    if (!ymaps) return null;
    const layout = (ymaps as any).templateLayoutFactory.createClass(
      `<div style="position: relative;"><div class="ymaps-avatar-marker" style="position: absolute; left: -23px; top: -52px; width: 46px; height: 52px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;">
        <div data-avatar-face class="rounded-full" style="width: 46px; height: 46px; border-radius: 50%; padding: 2px; background-color: #FAF7F2; border: 2.5px solid $[properties.borderColor]; box-shadow: 0 4px 14px rgba(43, 38, 35, 0.22); position: relative; box-sizing: border-box;">
          <img src="$[properties.avatarUrl]" alt="$[properties.name]" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; pointer-events: none;" onerror="this.src='/no-photo.svg'" />
          <span data-avatar-status aria-hidden="true" class="pointer-events-none absolute -bottom-0.5 -right-0.5 hidden h-2.5 w-2.5 rounded-full bg-zine-sage ring-1 ring-zine-paper"></span>
          <span data-avatar-serious aria-hidden="true" class="pointer-events-none absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-[#C77D86] text-[10px] leading-none text-white ring-1 ring-zine-paper">♥</span>
        </div>
        ${statusBadgeMarkup}
        <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid $[properties.borderColor]; margin: -1px auto 0 auto; pointer-events: none;"></div>
      </div></div>`,
      {
        build: function () {
          layout.superclass.build.call(this);
          const properties = this.getData().properties;
          const parent = this.getParentElement();
          if (properties.get('hasLiveStatus')) {
            parent?.querySelector('[data-avatar-face]')?.classList.add('ring-2', 'ring-zine-sage', 'ring-offset-1', 'ring-offset-zine-paper');
            parent?.querySelector('[data-avatar-status]')?.classList.remove('hidden');
          }
          if (properties.get('mutualSerious')) {
            const heart = parent?.querySelector('[data-avatar-serious]');
            if (heart) {
              heart.classList.remove('hidden');
              heart.classList.add('flex');
            }
          }
          const badge = fillStatusBadge(parent, properties.get('liveWant'), properties.get('liveOffer'));
          if (badge) {
            const side = properties.get('statusSide');
            badge.dataset.side = side;
            badge.style.top = '1px';
            badge.style.maxWidth = `${STATUS_NOTE_WIDTH}px`;
            badge.style[side === 'left' ? 'right' : 'left'] = '50px';
            badge.classList.add('border-zine-sage/60');
            const userId = properties.get('userId');
            statusBubbles.current.set(userId, badge);
            this.statusBubble = badge;
            this.statusUserId = userId;
          }
        },
        clear: function () {
          if (statusBubbles.current.get(this.statusUserId) === this.statusBubble) {
            statusBubbles.current.delete(this.statusUserId);
          }
          layout.superclass.clear.call(this);
        },
      }
    );
    return layout;
  }, [ymaps]);

  // «Ты» остаётся подписанным и на общем виде карты.
  const currentUserLayout = useMemo(() => {
    if (!ymaps) return null;
    const layout = (ymaps as any).templateLayoutFactory.createClass(
      `<div class="ymaps-current-user-marker relative h-[76px] w-[54px] cursor-pointer select-none font-sans">
        <span class="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-full border-2 border-zine-cardElevated bg-zine-terracotta px-2 text-cap font-bold text-white shadow-zine-sm">Ты</span>
        <div class="pointer-events-none absolute top-4 h-[52px] w-[52px] rounded-full border-[3px] border-zine-terracotta bg-zine-cardElevated p-0.5 shadow-zine">
          <img src="$[properties.avatarUrl]" alt="$[properties.name]" class="h-full w-full rounded-full object-cover" onerror="this.src='/no-photo.svg'" />
        </div>
        <span class="pointer-events-none absolute left-5 top-[67px] border-x-[6px] border-x-transparent border-t-[7px] border-t-zine-terracotta"></span>
        ${statusBadgeMarkup}
      </div>`,
      {
        build: function () {
          layout.superclass.build.call(this);
          const marker = this.getParentElement()?.querySelector('.ymaps-current-user-marker') as HTMLElement | null;
          const properties = this.getData().properties;
          const badge = fillStatusBadge(marker, properties.get('liveWant'), properties.get('liveOffer'));
          if (!marker || !badge) return;
          badge.style.top = '22px';
          const reposition = () => {
            const frame = marker.closest('[data-gulyai-map]')?.getBoundingClientRect();
            const pin = marker.getBoundingClientRect();
            if (!frame || !pin.width) return;
            const rightSpace = frame.right - pin.right;
            const leftSpace = pin.left - frame.left;
            const showOnRight = rightSpace >= 168 || rightSpace > leftSpace;
            const space = showOnRight ? rightSpace : leftSpace;
            badge.dataset.side = showOnRight ? 'right' : 'left';
            badge.style.maxWidth = `${Math.max(0, Math.min(160, space - 8))}px`;
            badge.style.left = showOnRight ? 'calc(100% + 5px)' : 'auto';
            badge.style.right = showOnRight ? 'auto' : 'calc(100% + 5px)';
          };
          this.repositionStatus = reposition;
          reposition();
          this.statusFrame = requestAnimationFrame(reposition);
          mapInstance?.events.add('boundschange', reposition);
          mapInstance?.events.add('actionend', reposition);
        },
        clear: function () {
          if (this.repositionStatus) {
            cancelAnimationFrame(this.statusFrame);
            mapInstance?.events.remove('boundschange', this.repositionStatus);
            mapInstance?.events.remove('actionend', this.repositionStatus);
            this.repositionStatus = undefined;
          }
          layout.superclass.clear.call(this);
        },
      }
    );
    return layout;
  }, [ymaps, mapInstance]);

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


  // Свежие данные и обработчики — через ref. Метки собираются заново, только когда меняются сами данные:
  // библиотека перерисовывает метку на каждый новый объект properties/options, и раньше любой рендер экрана
  // (открыли карточку, тапнули аватарку) перерисовывал все аватарки разом — зум и анимация подтормаживали
  const latest = useRef({ users, events, places, onSelectUser, onSelectCurrentUser, onSelectEvent, onSelectPlace, onClusterItems, mapInstance });
  latest.current = { users, events, places, onSelectUser, onSelectCurrentUser, onSelectEvent, onSelectPlace, onClusterItems, mapInstance };
  // Без flying: «перелёт» отдаляет и снова приближает карту, и детальные тайлы не успевают прогрузиться
  const panTo = (coords: [number, number]) => latest.current.mapInstance?.panTo(coords, { duration: 300 });

  const ownLiveStatus = useLiveStatus(currentUser?.liveStatus);
  const currentMark = useMemo(
    () => (
      <>
        {currentUser && currentUserCoords && (
          <Placemark
            key={`current-user-${currentUserCoords[0]}-${currentUserCoords[1]}-${ownLiveStatus?.expiresAt || ''}`}
            geometry={currentUserCoords}
            properties={{
              avatarUrl: thumb(currentUser.avatarUrl) || NO_PHOTO,
              name: currentUser.name || currentUser.firstName || 'Ты',
              liveWant: upperFirst(ownLiveStatus?.want || ''),
              liveOffer: shortOffer(ownLiveStatus?.offer || '')
            }}
            options={{
              iconLayout: currentUserLayout,
              iconOffset: [-27, -76],
              iconShape: { type: 'Rectangle', coordinates: [[0, 0], [54, 76]] } as any,
              interactivityModel: 'default#geoObject', // жесты с метки уходят карте: щипок по аватарке тоже приближает
              cursor: 'pointer',
              zIndex: 1000,
              hasBalloon: false
            } as any}
            onClick={() => {
              telegramService.haptic('selection');
              latest.current.onSelectCurrentUser?.();
              panTo(currentUserCoords);
            }}
          />
        )}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserLayout, currentUser?.avatarUrl, currentUser?.name, currentUser?.firstName, ownLiveStatus, currentUserCoords?.[0], currentUserCoords?.[1]]
  );

  const statusRevision = useLiveStatusExpiry(otherUsers);
  const statusCandidates = useMemo(() => otherUsers.flatMap(user => {
    const status = currentLiveStatus(user.liveStatus);
    return status && (status.want || status.offer) ? [{ id: mapUserId(user), coords: user.displayCoords }] : [];
  }), [otherUsers, statusRevision]);

  const [featuredPins, setFeaturedPins] = useState(NO_FEATURED_PINS);
  const hasOwnNote = Boolean(ownLiveStatus?.want || ownLiveStatus?.offer);
  useEffect(() => {
    if (!mapInstance || picking || !statusCandidates.length) {
      setFeaturedPins(NO_FEATURED_PINS);
      return;
    }
    const map = mapInstance;
    let timer: number | undefined;
    const refresh = () => {
      const [width, height] = map.container.getSize();
      const [centerX, centerY] = map.getGlobalPixelCenter();
      const zoom = map.getZoom();
      const projection = map.options.get('projection', null) as IProjection | null;
      if (!projection || !width || !height) return;
      const toScreen = (coords: [number, number]): [number, number] => {
        const [x, y] = projection.toGlobalPixels(ensureLatLng(coords), zoom);
        return [x - centerX + width / 2, y - centerY + height / 2];
      };
      const candidates = statusCandidates.map(({ id, coords }) => ({ id, point: toScreen(coords) }));
      const next = visibleStatusPins(candidates, width, height, statusTopInset,
        currentUserCoords ? toScreen(currentUserCoords) : null, hasOwnNote);
      setFeaturedPins(previous => previous.size === next.size &&
        Array.from(next).every(([id, side]) => previous.get(id) === side) ? previous : next);
    };
    // Keep the same faces during a map gesture and choose new ones once the view settles.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 120);
    };
    refresh();
    map.events.add(['boundschange', 'sizechange', 'actionend'], schedule);
    return () => {
      window.clearTimeout(timer);
      map.events.remove(['boundschange', 'sizechange', 'actionend'], schedule);
    };
  }, [mapInstance, statusCandidates, currentUserCoords, hasOwnNote, picking, statusTopInset]);

  const selectedUserId = selectedUser?.id;
  const { userMarks, featuredMarks } = useMemo(() => {
    const userMarks: React.ReactElement[] = [];
    const featuredMarks: React.ReactElement[] = [];
    otherUsers.forEach((user, idx) => {
      const isSelected = selectedUserId === user.id;
      const available = isAvailableNow(user);
      const activeStatus = currentLiveStatus(user.liveStatus);
      const coords = ensureLatLng(user.displayCoords);
      const userIdStr = mapUserId(user);
      const side = !picking && activeStatus ? featuredPins.get(userIdStr) : undefined;
      const live = side ? activeStatus : null;

      const mark = (
        <Placemark
          key={`user-${userIdStr || `idx-${idx}`}-${coords[0]}-${coords[1]}-${activeStatus?.expiresAt || ''}-${side || ''}`}
          geometry={coords}
          properties={{
            userId: userIdStr,
            avatarUrl: thumb(user.avatarUrl),
            name: user.firstName,
            liveWant: live ? upperFirst(live.want) : '',
            liveOffer: live ? shortOffer(live.offer) : '',
            statusSide: side,
            hasLiveStatus: Boolean(activeStatus),
            mutualSerious: Boolean(user.mutualSerious),
            borderColor: isSelected ? 'rgb(var(--c-terracotta))' : user.mutualSerious ? '#C77D86' : activeStatus || available ? 'rgb(var(--c-sage))' : 'rgb(var(--c-paper))'
          }}
          options={{
            iconLayout: avatarLayout,
            iconShape: { type: 'Rectangle', coordinates: [
              [side === 'left' ? -STATUS_NOTE_REACH : -23, -52],
              [side === 'right' ? STATUS_NOTE_REACH : 23, 0]
            ] },
            interactivityModel: 'default#geoObject', // жесты с метки уходят карте: щипок по аватарке тоже приближает
            cursor: 'pointer',
            zIndex: side ? 950 : isSelected ? 300 : activeStatus ? 200 : 100,
            hasBalloon: false
          } as any}
          onClick={(event: MapEvent) => {
            const point = side && event.get('clientPixels');
            const bubble = statusBubbles.current.get(userIdStr);
            if (point && bubble?.isConnected) {
              const [x, y] = point;
              const rect = bubble.getBoundingClientRect();
              // The clickable area around the pin is wider than the rendered bubble.
              if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                track('gulyai_map_live_status_clicked', { screen: 'map' });
              }
            }
            telegramService.haptic('selection');
            latest.current.onSelectUser(user);
            panTo(coords);
          }}
        />
      );
      (side ? featuredMarks : userMarks).push(mark);
    });
    return { userMarks, featuredMarks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarLayout, otherUsers, selectedUserId, featuredPins, statusRevision, picking]);

  // Места и сходки — в той же группировке: близкие метки сливаются в кружок с числом
  const placeMarks = useMemo(
    () => (
      <>
        {/* Места и сходки — в той же группировке: близкие метки сливаются в кружок с числом */}
        {/* Места по вайбу */}
        {placeLayout &&
          places.map((place) => (
            <Placemark
              key={`place-${place.id}`}
              geometry={place.coordinates}
              properties={{
                placeId: place.id,
                photo: place.photos[0] ? thumb(serverUrl(place.photos[0])) : placePlaceholder(PLACE_MOODS[place.moods[0]]?.emoji || '📍'),
                emoji: PLACE_MOODS[place.moods[0]]?.emoji || '📍'
              }}
              options={{
                iconLayout: placeLayout,
                iconOffset: [-29, -66],
                iconShape: { type: 'Rectangle', coordinates: [[0, 0], [58, 66]] } as any,
                interactivityModel: 'default#geoObject', // жесты с метки уходят карте: щипок по аватарке тоже приближает
                cursor: 'pointer',
                zIndex: 900,
                hasBalloon: false
              } as any}
              onClick={() => {
                telegramService.haptic('selection');
                latest.current.onSelectPlace?.(place);
                panTo(place.coordinates);
              }}
            />
          ))}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeLayout, places]
  );

  const eventMarks = useMemo(
    () => (
      <>
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
                interactivityModel: 'default#geoObject', // жесты с метки уходят карте: щипок по аватарке тоже приближает
                cursor: 'pointer',
                zIndex: 1100,
                hasBalloon: false
              } as any}
              onClick={() => {
                telegramService.haptic('medium');
                latest.current.onSelectEvent?.(ev);
                panTo(coords);
              }}
            />
          );
        })}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventLayout, eventCompactLayout, eventsWithSeparatedCoords, isZoomedIn]
  );

  const clusterOptions = useMemo(
    () =>
      ({
        clusterIconLayout: clusterLayout,
        clusterIconOffset: [-26, -26],
        clusterIconShape: { type: 'Circle', coordinates: [26, 26], radius: 28 } as any,
        gridSize: 64,
        groupByCoordinates: false,
        clusterDisableClickZoom: true, // приближаем сами — аккуратнее
        clusterOpenBalloonOnClick: false,
        clusterHideIconOnBalloonOpen: false,
        hasBalloon: false
      }) as any,
    [clusterLayout]
  );

  const handleClusterClick = useCallback((e: any) => {
    const map = latest.current.mapInstance;
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
        if (!bounds || span < 0.0006 || (map && map.getZoom() >= 17)) {
          const items: ClusterItem[] = clustered
            .map((obj: any): ClusterItem | null => {
              const p = obj.properties;
              const ev = p.get('eventId') ? latest.current.events.find((x) => String(x.id) === String(p.get('eventId'))) : null;
              if (ev) return { kind: 'event', event: ev };
              const pl = p.get('placeId') ? latest.current.places.find((x) => x.id === p.get('placeId')) : null;
              if (pl) return { kind: 'place', place: pl };
              const u = latest.current.users.find((x) => String(x.id || (x as any).telegramId) === String(p.get('userId')));
              return u ? { kind: 'user', user: u } : null;
            })
            .filter(Boolean) as ClusterItem[];
          latest.current.onClusterItems?.(items);
          return;
        }
        if (map) {
          map.setBounds(bounds, { checkZoomRange: true, zoomMargin: [90, 90, 90, 90], duration: 300 }).then(() => {
            if (map.getZoom() > 17) map.setZoom(17, { duration: 200 });
          });
        }
        return;
      } else if (clustered.length === 1) {
        const props = clustered[0]?.properties;
        const evId = props?.get('eventId');
        const plId = props?.get('placeId');
        if (evId) {
          const ev = latest.current.events.find((x) => String(x.id) === String(evId));
          if (ev) latest.current.onSelectEvent?.(ev);
          return;
        }
        if (plId) {
          const pl = latest.current.places.find((x) => x.id === plId);
          if (pl) latest.current.onSelectPlace?.(pl);
          return;
        }
        const userId = props?.get('userId');
        const found = latest.current.users.find((u: UserProfile) => String(u.id || (u as any).telegramId || (u as any)._id) === String(userId));
        if (found) {
          telegramService.haptic('selection');
          latest.current.onSelectUser(found);
          if (found.displayCoords) panTo(found.displayCoords);
        }
        return;
      }
    }

    // Обработка клика по одиночному маркеру
    const userId = target.properties?.get('userId');
    if (userId) {
      const found = latest.current.users.find((u: UserProfile) => String(u.id || (u as any).telegramId || (u as any)._id) === String(userId));
      if (found) {
        telegramService.haptic('selection');
        latest.current.onSelectUser(found);
        if (found.displayCoords) panTo(found.displayCoords);
      }
    }
  }, []);

  if (!ymaps || !avatarLayout || !clusterLayout || !eventLayout || !currentUserLayout) {
    return null;
  }

  return (
    <>
      {/* 1. Маркер запускающего приложение ("⭐️ ТЫ") */}
      {currentMark}

      {/* 2. Кластеризация: аватарки остальных, места и сходки */}
      <Clusterer options={clusterOptions} onClick={handleClusterClick}>
        {userMarks}
        {placeMarks}
        {eventMarks}
      </Clusterer>
      {featuredMarks}
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
  onOpenDonate,
  onSelectEvent,
  onToggleJoinEvent,
  onUpdateLocation,
  onUpdateUserCoordinates,
  userLocation,
  applyFuzzyOffset = false,
  places = [],
  onSelectPlace,
  shownCoords,
  statusTopInset = 124,
  picking = false,
  pickHint,
  onPickCenter
}) => {
  const mapRef = useRef<any>(null);
  // Приближена ли карта — от этого зависит размер меток сходок
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  // Экземпляр карты в состоянии — чтобы метки получили его после загрузки и могли приближать карту
  const [mapInstance, setMapInstance] = useState<YandexMap | null>(null);
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

  // Где показываем мою метку — тем же массивом, пока точка не сдвинулась (иначе метки пересобираются на каждый рендер)
  const shownLat = shownCoords ? ensureLatLng(shownCoords)[0] : null;
  const shownLng = shownCoords ? ensureLatLng(shownCoords)[1] : null;
  const myCoords = useMemo<[number, number] | null>(
    () => (picking ? null : shownLat !== null && shownLng !== null ? [shownLat, shownLng] : currentCoords),
    [picking, shownLat, shownLng, currentCoords]
  );

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
    <div data-gulyai-map className="w-full h-full relative overflow-hidden bg-zine-paper">
      <style>{`
        .ymaps-2-1-79-ground-pane,
        [class*="ground-pane"] { filter: sepia(20%) brightness(99%) contrast(94%) hue-rotate(-8deg) !important; }
        .ymaps-2-1-79-inner-panes { background-color: #F4EFE7 !important; }
        html.dark [class*="ground-pane"] { filter: invert(92%) hue-rotate(180deg) brightness(95%) contrast(88%) sepia(12%) !important; }
        html.dark .ymaps-2-1-79-inner-panes { background-color: #1C1917 !important; }
        /* Промо Яндекса: «Как добраться» (suppressMapOpenBlock в 2.1.79 его уже не прячет) и «Создать свою карту» / «API».
           Логотип и «Условия» не трогаем — их требуют правила API */
        [class*="gotoymaps"], [class*="gototech"] { display: none !important; }
      `}</style>

      <Map
        defaultState={{ center: MINSK_CENTER, zoom: 11, controls: [] }}
        // autoFitToViewport: карта сама растягивается, когда меняется высота экрана (например, закрыли строку подсказок)
        options={{ suppressMapOpenBlock: true, autoFitToViewport: 'always' }}
        className="w-full h-full"
        instanceRef={(ref: any) => {
          if (ref && mapRef.current !== ref) {
            mapRef.current = ref;
            // Сразу весь Минск (в пределах МКАД) — чтобы была видна активность по всему городу.
            // Отступы — под шапку сверху и кнопки снизу
            ref.setBounds(MINSK_BOUNDS, { checkZoomRange: true, preciseZoom: true, zoomMargin: [140, 0, 110, 0] }).catch?.(() => {});
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
          currentUserCoords={myCoords}
          selectedUser={selectedUser}
          onSelectUser={onSelectUser}
          onSelectCurrentUser={onSelectCurrentUser}
          onSelectEvent={handleEventClick}
          mapInstance={mapInstance}
          picking={picking}
          statusTopInset={statusTopInset}
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
                  : [item.place.photos[0] ? thumb(serverUrl(item.place.photos[0])) : '', PLACE_MOODS[item.place.moods[0]]?.emoji || '📍', item.place.name, 'Место'];
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
              {currentUser?.avatarUrl && <img src={thumb(currentUser.avatarUrl)} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="w-0 h-0 border-x-[7px] border-x-transparent border-t-[9px] border-t-zine-terracotta" />
          </div>
          {pickHint}
        </>
      )}

      {!picking && <MapQuickControls onDonate={onOpenDonate} onLocate={handleLocateGPS} locating={isGpsLoading} />}
    </div>
  );
};

export default MinskMap;
