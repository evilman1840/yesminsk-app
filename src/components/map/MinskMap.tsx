import React, { useRef, useMemo, useState } from 'react';
import { YMaps, Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import { UserProfile, AppEvent, GOALS_CONFIG, EVENT_CATEGORIES_CONFIG } from '../../types';
import { telegramService } from '../../services/telegram';

interface MinskMapProps {
  users: UserProfile[];
  events?: AppEvent[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectEvent?: (event: AppEvent) => void;
  userLocation?: [number, number];
  apiKey?: string;
  applyFuzzyOffset?: boolean;
}

const MINSK_CENTER: [number, number] = [53.9045, 27.5615];

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
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectEvent?: (event: AppEvent) => void;
  mapInstance: any;
}> = ({ users, events, selectedUser, onSelectUser, onSelectEvent, mapInstance }) => {
  const ymaps = useYMaps(['templateLayoutFactory', 'shape.Circle', 'geometry.pixel.Circle', 'shape.Rectangle', 'geometry.pixel.Rectangle']);

  // 1. Макет круглой аватарки пользователя
  const avatarLayout = useMemo(() => {
    if (!ymaps) return null;

    return ymaps.templateLayoutFactory.createClass(
      `<div style="cursor: pointer; transform: translate(-50%, -100%);">
        <div style="
          width: 46px;
          height: 46px;
          border-radius: 50%;
          padding: 2px;
          background-color: #FAF7F2;
          border: 2.5px solid $[properties.borderColor];
          box-shadow: 0 4px 14px rgba(43, 38, 35, 0.2);
          position: relative;
          box-sizing: border-box;
          transition: transform 0.15s ease;
        ">
          <img 
            src="$[properties.avatarUrl]" 
            alt="$[properties.name]" 
            style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" 
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

  // 2. Макет квадратного маркера сходки (со звездочкой/эмодзи и числом участников)
  const eventLayout = useMemo(() => {
    if (!ymaps) return null;

    return ymaps.templateLayoutFactory.createClass(
      `<div style="cursor: pointer; transform: translate(-50%, -100%);">
        <div style="
          min-width: 46px;
          height: 46px;
          border-radius: 14px;
          padding: 3px 6px;
          background-color: #E2A03F;
          border: 2.5px solid #FAF7F2;
          box-shadow: 0 4px 16px rgba(226, 160, 63, 0.45);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          position: relative;
          box-sizing: border-box;
          transition: transform 0.15s ease;
        ">
          <span style="font-size: 14px; line-height: 1;">$[properties.eventEmoji]</span>
          <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; font-family: sans-serif;">сходка</span>
          <span style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: #D95C3C;
            color: #FFFFFF;
            font-size: 9px;
            font-weight: 700;
            border-radius: 8px;
            padding: 1px 4px;
            border: 1.5px solid #FAF7F2;
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

  // 3. Макет кластера людей
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
        <span style="font-size: 7.5px; text-transform: uppercase; font-weight: 600; opacity: 0.9; margin-top: 1px; letter-spacing: 0.5px;">места</span>
      </div>`
    );
  }, [ymaps]);

  const avatarShape = useMemo(() => {
    if (!ymaps) return null;
    if (ymaps.shape?.Circle && ymaps.geometry?.pixel?.Circle) {
      return new ymaps.shape.Circle(
        new ymaps.geometry.pixel.Circle([0, -25], 23)
      );
    }
    return { type: 'Circle', coordinates: [0, -25], radius: 23 } as any;
  }, [ymaps]);

  const clusterShape = useMemo(() => {
    if (!ymaps) return null;
    if (ymaps.shape?.Circle && ymaps.geometry?.pixel?.Circle) {
      return new ymaps.shape.Circle(
        new ymaps.geometry.pixel.Circle([0, 0], 22)
      );
    }
    return { type: 'Circle', coordinates: [0, 0], radius: 22 } as any;
  }, [ymaps]);

  if (!ymaps || !avatarLayout || !clusterLayout || !eventLayout) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zine-paper/70 backdrop-blur-xs">
        <div className="w-8 h-8 rounded-full border-2 border-zine-terracotta border-t-transparent animate-spin mb-2" />
        <span className="font-serif text-xs text-zine-ink font-medium">Загружаем карту Минска...</span>
      </div>
    );
  }

  return (
    <>
      {/* Кластеризация аватарок пользователей */}
      <Clusterer
        options={{
          clusterIconLayout: clusterLayout,
          clusterIconShape: clusterShape as any,
          gridSize: 64,
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterHideIconOnBalloonOpen: false,
          geoObjectHideIconOnBalloonOpen: false
        }}
      >
        {users.map((user) => {
          const isSelected = selectedUser?.id === user.id;
          const goalInfo = GOALS_CONFIG[user.goal] || { emoji: '☕️', label: 'Досуг' };

          return (
            <Placemark
              key={user.id}
              geometry={user.displayCoords}
              properties={{
                avatarUrl: user.avatarUrl,
                name: user.firstName,
                goalEmoji: goalInfo.emoji,
                borderColor: isSelected ? '#D95C3C' : '#FAF7F2'
              }}
              options={{
                iconLayout: avatarLayout,
                iconShape: avatarShape as any,
                iconOffset: [0, 0],
                cursor: 'pointer'
              }}
              onClick={() => {
                telegramService.haptic('selection');
                onSelectUser(user);

                if (mapInstance) {
                  mapInstance.panTo(user.displayCoords, {
                    flying: true,
                    duration: 400
                  });
                }
              }}
            />
          );
        })}
      </Clusterer>

      {/* Маркеры событий (Сходок) — квадратные, со звездочкой/эмодзи и числом участников */}
      {events.map((ev) => {
        const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || { emoji: '⭐️' };

        return (
          <Placemark
            key={`event-${ev.id}`}
            geometry={ev.coordinates}
            properties={{
              eventEmoji: catConfig.emoji || '⭐️',
              title: ev.title,
              participantsCount: ev.participantsCount || 1
            }}
            options={{
              iconLayout: eventLayout,
              iconOffset: [0, 0],
              cursor: 'pointer',
              zIndex: 200
            }}
            onClick={() => {
              telegramService.haptic('medium');
              if (onSelectEvent) {
                onSelectEvent(ev);
              }
              if (mapInstance) {
                mapInstance.panTo(ev.coordinates, {
                  flying: true,
                  duration: 400
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
  selectedUser,
  onSelectUser,
  onSelectEvent,
  userLocation,
  apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || '',
  applyFuzzyOffset = false
}) => {
  const mapRef = useRef<any>(null);
  const [, setMapReady] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const usersWithSafeCoords = useMemo(() => {
    return users.map((user) => {
      const displayCoords: [number, number] = applyFuzzyOffset
        ? obfuscateCoordinates(user.coordinates[0], user.coordinates[1])
        : user.coordinates;

      return {
        ...user,
        displayCoords
      };
    });
  }, [users, applyFuzzyOffset]);

  // Кнопка "Где я?" через реальный GPS браузера/телеграма
  const handleLocateGPS = () => {
    telegramService.haptic('light');

    if (!navigator.geolocation) {
      if (mapRef.current) {
        mapRef.current.setCenter(userLocation || MINSK_CENTER, 14, { duration: 500 });
      }
      return;
    }

    setIsGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        telegramService.haptic('success');
        if (mapRef.current) {
          mapRef.current.setCenter([lat, lng], 15, { duration: 600 });
        }
      },
      () => {
        setIsGpsLoading(false);
        if (mapRef.current) {
          mapRef.current.setCenter(userLocation || MINSK_CENTER, 14, { duration: 500 });
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
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
            center: MINSK_CENTER,
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
              setMapReady(true);
            }
          }}
        >
          <MinskMapContent
            users={usersWithSafeCoords}
            events={events}
            selectedUser={selectedUser}
            onSelectUser={onSelectUser}
            onSelectEvent={onSelectEvent}
            mapInstance={mapRef.current}
          />
        </Map>
      </YMaps>

      {/* Кнопка "Где я?" (GPS) в правом нижнем углу карты */}
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
