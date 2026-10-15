import React, { useRef, useMemo, useState } from 'react';
import { YMaps, Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import { UserProfile, GOALS_CONFIG } from '../../types';
import { telegramService } from '../../services/telegram';

interface MinskMapProps {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  userLocation?: [number, number];
  apiKey?: string;
  applyFuzzyOffset?: boolean;
}

// Центр Минска (Октябрьская / Немига)
const MINSK_CENTER: [number, number] = [53.9045, 27.5615];

/**
 * Безопасное смещение координат (рандомизация в радиусе 300-500м)
 * для защиты конфиденциальности пользователей.
 */
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

/**
 * Внутренний компонент с доступом к ymaps API для создания HTML-макетов
 */
const MinskMapContent: React.FC<{
  users: (UserProfile & { displayCoords: [number, number] })[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  mapInstance: any;
}> = ({ users, selectedUser, onSelectUser, mapInstance }) => {
  const ymaps = useYMaps(['templateLayoutFactory', 'shape.Circle', 'geometry.pixel.Circle']);

  // 1. Кастомный макет маркера-аватарки в стиле «Теплый зин»
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

  // 2. Кастомный макет терракотового кластера
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

  // 3. Активная область (hotspot) аватарки — совместимо с типами ymaps.IShape
  const avatarShape = useMemo(() => {
    if (!ymaps) return null;

    if (ymaps.shape?.Circle && ymaps.geometry?.pixel?.Circle) {
      return new ymaps.shape.Circle(
        new ymaps.geometry.pixel.Circle([0, -25], 23)
      );
    }

    return {
      type: 'Circle',
      coordinates: [0, -25],
      radius: 23
    } as any;
  }, [ymaps]);

  // 4. Активная область (hotspot) кластера — совместимо с типами ymaps.IShape
  const clusterShape = useMemo(() => {
    if (!ymaps) return null;

    if (ymaps.shape?.Circle && ymaps.geometry?.pixel?.Circle) {
      return new ymaps.shape.Circle(
        new ymaps.geometry.pixel.Circle([0, 0], 22)
      );
    }

    return {
      type: 'Circle',
      coordinates: [0, 0],
      radius: 22
    } as any;
  }, [ymaps]);

  if (!ymaps || !avatarLayout || !clusterLayout) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zine-paper/70 backdrop-blur-xs">
        <div className="w-8 h-8 rounded-full border-2 border-zine-terracotta border-t-transparent animate-spin mb-2" />
        <span className="font-serif text-xs text-zine-ink font-medium">Загружаем карту Минска...</span>
      </div>
    );
  }

  return (
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
  );
};

export const MinskMap: React.FC<MinskMapProps> = ({
  users,
  selectedUser,
  onSelectUser,
  userLocation,
  apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || '3c4909ba-bf12-452a-8dfa-af770c3f7160',
  applyFuzzyOffset = false
}) => {
  const mapRef = useRef<any>(null);
  const [, setMapReady] = useState(false);

  // Подготовка координат с защитным смещением (при необходимости)
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

  // Центрирование карты кнопкой «Я здесь»
  const handleLocateMe = () => {
    telegramService.haptic('light');
    if (!mapRef.current) return;

    const targetCoords = userLocation || MINSK_CENTER;
    mapRef.current.setCenter(targetCoords, userLocation ? 14 : 13, {
      duration: 500
    });
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-zine-paper">
      {/* Мягкий CSS-фильтр для придания Яндекс.Картам стилистики теплого зина */}
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
            controls: [] // Отключаем лишние элементы управления
          }}
          options={{
            suppressMapOpenBlock: true // Скрываем плашку «Открыть в Яндекс.Картах»
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
            selectedUser={selectedUser}
            onSelectUser={onSelectUser}
            mapInstance={mapRef.current}
          />
        </Map>
      </YMaps>

      {/* Кнопка центрирования «Я здесь» */}
      <button
        onClick={handleLocateMe}
        className="absolute right-3 bottom-24 w-10 h-10 rounded-full bg-zine-cardElevated/95 backdrop-blur-sm border border-zine-border shadow-zine flex items-center justify-center text-sm z-20 active:scale-90 transition-transform"
        title="Моё местоположение"
      >
        🎯
      </button>
    </div>
  );
};

export default MinskMap;
