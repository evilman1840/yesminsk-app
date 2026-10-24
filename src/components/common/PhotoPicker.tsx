import React, { useRef, useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { api, serverUrl } from '../../services/api';
import { telegramService } from '../../services/telegram';
import { compressImage } from '../../utils/compressImage';
import { PHOTO_TEXTS as T } from '../../texts/photos';

export interface PickedPhoto {
  id: string;  // file_id на сервере ('' — ещё грузится)
  url: string; // что показывать: адрес на сервере или превью
}

// Адрес фото с сервера (/api/photos/<id>) → id
export const photoFromUrl = (url: string): PickedPhoto => ({ id: decodeURIComponent(url.split('/').pop() || ''), url });
export const photoSrc = (url: string) => (url.startsWith('/') ? serverUrl(url) : url);

/**
 * До 5 фото: сжимаем на телефоне, грузим на сервер, первое — обложка
 */
export const PhotoPicker: React.FC<{
  value: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  onBusyChange?: (busy: boolean) => void;
  max?: number;
  showCover?: boolean; // у анкеты обложка — главное фото, тут подпись не нужна
}> = ({ value, onChange, onBusyChange, max = 5, showCover = true }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const update = (next: PickedPhoto[]) => {
    latest.current = next;
    onChange(next);
    onBusyChange?.(next.some((p) => !p.id));
  };

  const addFiles = async (files: File[]) => {
    setError(null);
    const free = max - latest.current.length;
    if (files.length > free) setError(T.limit(max));
    for (const file of files.slice(0, Math.max(0, free))) {
      const key = `uploading-${Math.random()}`;
      try {
        const preview = await compressImage(file);
        update([...latest.current, { id: '', url: preview + `#${key}` }]);
        const { id } = await api.uploadPhoto(preview);
        update(latest.current.map((p) => (p.url.endsWith(`#${key}`) ? { id, url: preview } : p)));
      } catch {
        update(latest.current.filter((p) => !p.url.endsWith(`#${key}`)));
        setError(T.failed);
      }
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {value.map((p, i) => (
          <div key={p.url} className="relative aspect-square rounded-zine-sm overflow-hidden bg-zine-card">
            <img src={photoSrc(p.url.split('#')[0])} alt="" className="w-full h-full object-cover" />
            {!p.id && (
              <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                <Loader2 size={22} className="animate-spin" />
              </span>
            )}
            {showCover && i === 0 && p.id && <span className="absolute left-1.5 bottom-1.5 px-2 py-0.5 rounded-full bg-black/55 text-white text-[11px] font-semibold">{T.cover}</span>}
            {p.id && (
              <button
                type="button"
                aria-label={T.remove}
                onClick={() => {
                  telegramService.haptic('light');
                  update(value.filter((x) => x !== p));
                }}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-zine-sm border-2 border-dashed border-zine-border text-zine-inkMuted flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-[0.97] transition-transform"
          >
            <Plus size={24} />
            <span className="text-cap font-semibold">{T.add}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) addFiles(files);
        }}
      />
      {error && <p className="mt-2 text-sm2 font-semibold text-zine-danger">{error}</p>}
    </div>
  );
};
