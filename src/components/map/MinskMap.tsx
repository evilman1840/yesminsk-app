import React, { useRef, useMemo, useState } from 'react';
import { YMaps, Map, Clusterer, Placemark, useYMaps } from '@pbe/react-yandex-maps';
import { Clock, MapPin, X, Send, Check, Sparkles } from 'lucide-react';
import { UserProfile, AppEvent, GOALS_CONFIG, EVENT_CATEGORIES_CONFIG } from '../../types';
import { telegramService } from '../../services/telegram';

interface MinskMapProps {
  users: UserProfile[];
  events?: AppEvent[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  onSelectEvent?: (event: AppEvent) => void;
  onToggleJoinEvent?: (event: AppEvent) => void;
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

  // 2. Макет квадратного маркера события (сходки) с календарем/звездочкой
  const eventLayout = useMemo(() => {
    if (!ymaps) return null;

    return ymaps.templateLayoutFactory.createClass(
      `<div style="cursor: pointer; transform: translate(-50%, -100%);">
        <div style="
          min-width: 48px;
          height: 48px;
          border-radius: 15px;
          padding: 3px 6px;
          background-color: #E2A03F;
          border: 2.5px solid #FAF7F2;
          box-shadow: 0 4px 16px rgba(226, 160, 63, 0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          position: relative;
          box-sizing: border-box;
          transition: transform 0.15s ease;
        ">
          <span style="font-size: 15px; line-height: 1;">$[properties.eventEmoji]</span>
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

      {/* Маркеры событий (Сходок) — золотистый маркер с эмодзи/календарем */}
      {events.map((ev) => {
        const catConfig = EVENT_CATEGORIES_CONFIG[ev.category] || { emoji: '⭐️' };

        return (
          <Placemark
            key={`event-${ev.id}`}
            geometry={ev.coordinates}
            properties={{
              eventEmoji: catConfig.emoji || '🗓️',
              title: ev.title,
              participantsCount: ev.participantsCount || 1
            }}
            options={{
              iconLayout: eventLayout,
              iconOffset: [0, 0],
              cursor: 'pointer',
              zIndex: 250
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
  onToggleJoinEvent,
  userLocation,
  apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || '',
  applyFuzzyOffset = false
}) => {
  const mapRef = useRef<any>(null);
  const [, setMapReady] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Локальное состояние для всплывающей карточки события прямо на карте
  const [cardEvent, setCardEvent] = useState<AppEvent | null>(null);

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

  // Обработка клика по сходке
  const handleEventClick = (ev: AppEvent) => {
    setCardEvent(ev);
    if (onSelectEvent) {
      onSelectEvent(ev);
    }
  };

  // Кнопка "Где я?" через GPS
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
            onSelectUser={(u) => {
              setCardEvent(null);
              onSelectUser(u);
            }}
            onSelectEvent={handleEventClick}
            mapInstance={mapRef.current}
          />
        </Map>
      </YMaps>

      {/* Всплывающая карточка сходки при клике на маркер события на карте */}
      {cardEvent && (
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
