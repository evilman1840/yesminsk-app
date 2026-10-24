import React, { useEffect, useRef, useState } from 'react';
import { Map, useYMaps } from '@pbe/react-yandex-maps';
import { MapPin, X, Loader2, Check } from 'lucide-react';
import { telegramService } from '../../services/telegram';
import { useBackButton, useMainButton } from '../../hooks/useTelegram';

const MINSK_CENTER: [number, number] = [53.9045, 27.5615];

const cleanAddress = (line: string) => line.replace(/^Беларусь,\s*/, '').replace(/^Минск,\s*/, '');

const addressFromYandex = async (ymaps: any, coords: [number, number]): Promise<string | null> => {
  try {
    const res = await ymaps.geocode(coords, { results: 1 });
    const obj: any = res.geoObjects?.get?.(0);
    const line: string | null = obj?.getAddressLine?.() || obj?.properties?.get('name') || null;
    return line ? cleanAddress(line) : null;
  } catch {
    return null;
  }
};

// OpenStreetMap — запасной вариант, если Яндекс не ответил
const addressFromOsm = async ([lat, lng]: [number, number]): Promise<string | null> => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'ru' }
    });
    if (!response.ok) return null;
    const a = (await response.json())?.address || {};
    const street = a.road || a.pedestrian || a.square || a.park || a.neighbourhood;
    return street ? [street, a.house_number].filter(Boolean).join(', ') : null;
  } catch {
    return null;
  }
};

/**
 * «Указать на карте»: тапни по карте или подвинь её — метка в центре.
 * Возвращает точку и адрес, который нашёлся рядом с ней
 */
export const MapPicker: React.FC<{
  initial?: [number, number] | null;
  onPick: (coords: [number, number], address: string | null) => void;
  onClose: () => void;
}> = ({ initial, onPick, onClose }) => {
  useBackButton(onClose);
  const ymaps = useYMaps(['geocode']);
  const mapRef = useRef<any>(null);
  const [center, setCenter] = useState<[number, number]>(initial || MINSK_CENTER);
  const [address, setAddress] = useState<string | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const pick = () => {
    telegramService.haptic('success');
    const c = mapRef.current?.getCenter() || center;
    onPick([Number(c[0].toFixed(6)), Number(c[1].toFixed(6))], address);
  };
  const hasNativePick = useMainButton({ text: 'Встречаемся здесь', onClick: pick, enabled: !isMoving });

  // Адрес под меткой — ищем, когда карта остановилась
  useEffect(() => {
    if (isMoving) return;
    let cancelled = false;
    setIsLooking(true);
    const timer = window.setTimeout(async () => {
      const found = (await addressFromYandex(ymaps, center)) || (await addressFromOsm(center));
      if (!cancelled) {
        setAddress(found);
        setIsLooking(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ymaps, center, isMoving]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-black/60">
      <div className="relative w-full max-w-[420px] h-full bg-zine-paper">
        <Map
          defaultState={{ center, zoom: initial ? 16 : 13, controls: [] }}
          options={{ suppressMapOpenBlock: true }}
          className="absolute inset-0"
          instanceRef={(ref: any) => {
            if (!ref || mapRef.current === ref) return;
            mapRef.current = ref;
            ref.events.add('actionbegin', () => setIsMoving(true));
            ref.events.add('actionend', () => {
              setIsMoving(false);
              setCenter(ref.getCenter());
            });
            // Тап по карте — переносим метку туда
            ref.events.add('click', (e: any) => {
              const coords = e.get('coords');
              telegramService.haptic('selection');
              ref.panTo(coords, { duration: 250 }).then(() => setCenter(ref.getCenter()));
            });
          }}
        />

        {/* Метка всегда в центре карты */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none flex flex-col items-center">
          <MapPin size={48} className={`text-zine-terracotta fill-zine-terracotta/25 drop-shadow-lg transition-transform ${isMoving ? '-translate-y-2' : ''}`} strokeWidth={2.2} />
        </div>

        <div className="absolute top-0 inset-x-0 z-20 p-3 flex items-start gap-2">
          <p className="flex-1 p-3 rounded-zine bg-zine-cardElevated shadow-zine-float text-sm2 font-semibold text-zine-ink">
            👆 Тапни по карте или подвинь её, метка покажет место встречи
          </p>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="w-12 h-12 shrink-0 rounded-full bg-zine-cardElevated shadow-zine-float text-zine-ink flex items-center justify-center cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        <div className="absolute bottom-0 inset-x-0 z-20 p-3 pb-safe">
          <div className="p-4 rounded-zine bg-zine-cardElevated shadow-zine-float">
            <p className="text-cap font-semibold text-zine-inkMuted">Место встречи</p>
            <p className="mt-0.5 min-h-[24px] text-body font-bold text-zine-ink flex items-center gap-2">
              {isLooking || isMoving ? <Loader2 size={18} className="animate-spin text-zine-inkMuted" /> : address || 'Точка на карте'}
            </p>
            {!hasNativePick && (
              <button
                onClick={pick}
                disabled={isMoving}
                className="mt-3 w-full h-14 rounded-zine-sm bg-zine-terracotta active:bg-zine-terracottaHover text-white text-lead font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <Check size={22} strokeWidth={3} />
                Встречаемся здесь
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
