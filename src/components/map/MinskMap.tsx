import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { UserProfile, GOALS_CONFIG } from '../../types';
import { telegramService } from '../../services/telegram';

interface MinskMapProps {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  userLocation?: [number, number];
}

interface ClusterGroup {
  id: string;
  isCluster: boolean;
  coordinates: [number, number];
  users: UserProfile[];
}

export const MinskMap: React.FC<MinskMapProps> = ({
  users,
  selectedUser,
  onSelectUser,
  userLocation
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Координаты центра Минска (Немига / Октябрьская)
  const MINSK_CENTER: [number, number] = [53.9045, 27.5615];

  // 1. Инициализация карты Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: MINSK_CENTER,
      zoom: 13,
      minZoom: 11,
      maxZoom: 17,
      zoomControl: false,
      attributionControl: false
    });

    // Светлая минималистичная подложка тайлов CartoDB Positron
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Алгоритм динамической кластеризации маркеров
  const clusters = useMemo(() => {
    const currentZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : 13;
    const clusterDistance = 0.015 * Math.pow(0.5, currentZoom - 12);

    const groups: ClusterGroup[] = [];
    const visited = new Set<string>();

    users.forEach((u1, i) => {
      if (visited.has(u1.id)) return;

      const clusterUsers: UserProfile[] = [u1];
      visited.add(u1.id);

      users.forEach((u2, j) => {
        if (i !== j && !visited.has(u2.id)) {
          const dLat = Math.abs(u1.coordinates[0] - u2.coordinates[0]);
          const dLng = Math.abs(u1.coordinates[1] - u2.coordinates[1]);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);

          if (dist < clusterDistance) {
            clusterUsers.push(u2);
            visited.add(u2.id);
          }
        }
      });

      if (clusterUsers.length > 1) {
        const avgLat = clusterUsers.reduce((s, u) => s + u.coordinates[0], 0) / clusterUsers.length;
        const avgLng = clusterUsers.reduce((s, u) => s + u.coordinates[1], 0) / clusterUsers.length;

        groups.push({
          id: `cluster-${u1.id}`,
          isCluster: true,
          coordinates: [avgLat, avgLng],
          users: clusterUsers
        });
      } else {
        groups.push({
          id: u1.id,
          isCluster: false,
          coordinates: u1.coordinates,
          users: [u1]
        });
      }
    });

    return groups;
  }, [users, mapInstanceRef.current?.getZoom()]);

  // 3. Отрисовка маркеров аватарок и кластеров
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    clusters.forEach((item) => {
      if (item.isCluster) {
        // Маркер кластера
        const count = item.users.length;
        const clusterHtml = `
          <div class="w-10 h-10 rounded-full bg-[#D95C3C] text-white flex flex-col items-center justify-center font-bold text-xs shadow-md border-2 border-[#FAF7F2] cursor-pointer transform hover:scale-110 transition-transform">
            <span>${count}</span>
            <span class="text-[7px] uppercase font-semibold -mt-1 opacity-90">места</span>
          </div>
        `;

        const clusterIcon = L.divIcon({
          html: clusterHtml,
          className: 'custom-cluster-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const marker = L.marker(item.coordinates, { icon: clusterIcon }).addTo(markersLayer);

        marker.on('click', () => {
          telegramService.haptic('selection');
          map.setView(item.coordinates, map.getZoom() + 2, { animate: true });
        });
      } else {
        // Одиночный маркер пользователя
        const user = item.users[0];
        const isSelected = selectedUser?.id === user.id;
        const goal = GOALS_CONFIG[user.goal];

        const avatarHtml = `
          <div class="relative flex flex-col items-center cursor-pointer transition-transform ${isSelected ? 'scale-110 z-30' : 'hover:scale-105'}">
            <div class="w-11 h-11 rounded-full p-0.5 bg-[#FAF7F2] shadow-md relative border-2 ${isSelected ? 'border-[#D95C3C] ring-2 ring-[#D95C3C]/30' : 'border-[#E8DFD5]'}">
              <img src="${user.avatarUrl}" alt="${user.firstName}" class="w-full h-full rounded-full object-cover" />
              <span class="absolute -bottom-1 -right-1 text-[10px] bg-white rounded-full p-0.5 shadow-sm border border-[#E8DFD5]">
                ${goal.emoji}
              </span>
            </div>
            <div class="w-1.5 h-1.5 rounded-full bg-[#D95C3C] mt-0.5 border border-white"></div>
          </div>
        `;

        const avatarIcon = L.divIcon({
          html: avatarHtml,
          className: 'custom-avatar-marker',
          iconSize: [44, 48],
          iconAnchor: [22, 48]
        });

        const marker = L.marker(user.coordinates, { icon: avatarIcon }).addTo(markersLayer);

        marker.on('click', () => {
          telegramService.haptic('selection');
          onSelectUser(user);
          map.panTo(user.coordinates, { animate: true });
        });
      }
    });
  }, [clusters, selectedUser, onSelectUser]);

  // Кнопка центрирования на пользователе
  const handleLocateMe = () => {
    telegramService.haptic('light');
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLocation) {
      map.setView(userLocation, 14, { animate: true });
    } else {
      map.setView(MINSK_CENTER, 13, { animate: true });
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Стилизация тайлов Leaflet под теплый зин через CSS-фильтр */}
      <style>{`
        .leaflet-tile {
          filter: sepia(30%) brightness(98%) contrast(92%) hue-rotate(-12deg) !important;
        }
        .leaflet-container {
          background-color: #F4EFE7 !important;
          font-family: inherit;
        }
      `}</style>

      {/* Контейнер Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Кнопка "Я здесь" */}
      <button
        onClick={handleLocateMe}
        className="absolute right-3 bottom-24 w-10 h-10 rounded-full bg-zine-cardElevated border border-zine-border shadow-zine flex items-center justify-center text-sm z-20 active:scale-90 transition-transform"
        title="Моё местоположение"
      >
        🎯
      </button>
    </div>
  );
};
