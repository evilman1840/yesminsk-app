import React, { cloneElement, createContext, isValidElement, useContext, useId } from 'react';
import { X, ChevronRight, Play } from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { telegramService } from '../services/telegram';
import { SERIAL_DEFS } from './defs';
import { EPISODES, SerialEpisode } from './episodes';
import { releaseDay, SerialState } from './useSerial';

// Персонажи для кадров, плашки и полки: рисуются один раз на всё приложение
export const SerialDefs: React.FC = () => <div className="serial" aria-hidden dangerouslySetInnerHTML={{ __html: SERIAL_DEFS }} />;

// Лицо персонажа в круге
const Face: React.FC<{ who: string; size: number }> = ({ who, size }) => (
  <span className="serial block rounded-full overflow-hidden bg-[#F6E2BD] shrink-0" style={{ width: size, height: size }}>
    <svg viewBox="45 40 110 110" width={size} height={size} aria-hidden>
      <use href={`#${who}`} />
      {who === 'vasya' && <use href="#v-smile" />}
    </svg>
  </span>
);

/**
 * Плашка над нижним меню, на всех вкладках: есть серия, которую я ещё не открывал.
 * ✕ прячет до следующей серии (на полке в «Новостях» серия остаётся)
 */
export const SerialStrip: React.FC<{ serial: SerialState; onOpen: (ep: SerialEpisode) => void }> = ({ serial, onOpen }) => {
  const ep = serial.waiting;
  if (!ep || !serial.showStrip) return null;
  const fromStart = ep.n === 1 || !Object.keys(serial.seen).length;
  return (
    <div className="relative h-0 z-40">
      <div className="absolute inset-x-2 bottom-2 rounded-zine bg-[#2B2623] text-[#FFF6E6] shadow-zine-float flex items-center gap-2 pl-2 pr-1 py-1.5">
        <button onClick={() => onOpen(ep)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer">
          <span className="p-[2px] rounded-full bg-[conic-gradient(#D95C3C,#E2A03F,#D95C3C)]">
            <span className="block rounded-full border-2 border-[#2B2623]">
              <Face who="vasya" size={34} />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-hand font-bold text-[22px] leading-none whitespace-nowrap">Не Одна Дома</span>
            <span className="block mt-0.5 text-cap text-[#FFF6E6]/80 truncate">
              {fromStart && ep.n === 1 ? 'Серия 1 · 30 секунд' : `Серия ${ep.n} · новая!`}
            </span>
          </span>
          <span className="shrink-0 h-9 px-3 rounded-zine-sm bg-zine-terracotta text-white text-sm2 font-bold flex items-center">Смотреть</span>
        </button>
        <button onClick={() => serial.hideStrip(ep.n)} aria-label="Скрыть до следующей серии" className="shrink-0 w-9 h-9 grid place-items-center text-[#FFF6E6]/70 cursor-pointer">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

/** После «Попробовать» над меню: вернуться к серии с того же кадра */
export const SerialResumeStrip: React.FC<{ ep: SerialEpisode; onOpen: () => void; onClose: () => void }> = ({ ep, onOpen, onClose }) => (
  <div className="relative h-0 z-40">
    <div className="absolute inset-x-2 bottom-2 rounded-zine bg-[#2B2623] text-[#FFF6E6] shadow-zine-float flex items-center gap-2 pl-2 pr-1 py-1.5">
      <button onClick={onOpen} aria-label={`Досмотреть серию ${ep.n}`} className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer">
        <Face who={ep.thumb} size={36} />
        <span className="flex-1 min-w-0">
          <span className="block font-hand font-bold text-[22px] leading-none truncate">Досмотреть серию {ep.n}</span>
          <span className="block mt-0.5 text-cap text-[#FFF6E6]/80 truncate">Не Одна Дома · с того места</span>
        </span>
        <span aria-hidden className="shrink-0 w-10 h-10 rounded-full bg-zine-terracotta text-white grid place-items-center">
          <Play size={18} fill="currentColor" className="ml-0.5" />
        </span>
      </button>
      <button onClick={onClose} aria-label="Не досматривать" className="shrink-0 w-9 h-9 grid place-items-center text-[#FFF6E6]/70 cursor-pointer">
        <X size={18} />
      </button>
    </div>
  </div>
);

/** Ряд серий: вышедшие и следующая с днём выхода */
const EpisodeRow: React.FC<{ serial: SerialState; onOpen: (ep: SerialEpisode) => void }> = ({ serial, onOpen }) => {
  const list = [...serial.released, ...(serial.upcoming ? [serial.upcoming] : [])];
  return (
    <div className="-mx-1 px-1 flex gap-2 overflow-x-auto no-scrollbar pb-1 snap-x">
      {list.map((ep) => {
        const open = serial.released.includes(ep);
        const watched = !!serial.seen[ep.n];
        const isNew = open && !watched;
        return (
          <button
            key={ep.n}
            disabled={!open}
            onClick={() => onOpen(ep)}
            aria-label={`Серия ${ep.n}. ${ep.title}`}
            className={`serial relative shrink-0 snap-start w-[104px] aspect-[9/13] rounded-zine-sm overflow-hidden border-2 border-[#2B2623] text-left ${
              open ? 'cursor-pointer active:scale-[0.97] transition-transform' : 'opacity-70'
            } ${isNew ? 'ring-2 ring-zine-mustard ring-offset-2 ring-offset-zine-paper' : ''}`}
            style={{ background: open ? ep.color : '#6B635C' }}
          >
            <svg viewBox="30 40 140 140" className={`absolute inset-x-0 bottom-0 w-full ${open ? '' : 'grayscale blur-[1.5px] opacity-50'}`} aria-hidden>
              <use href={`#${ep.thumb}`} />
              {ep.thumb === 'vasya' && <use href="#v-smile" />}
            </svg>
            <span className="absolute top-1.5 left-2 font-hand font-bold text-[24px] leading-none text-[#FFF6E6]">{ep.n}</span>
            <span
              className={`absolute bottom-1.5 inset-x-1.5 rounded-md py-0.5 text-center text-[11px] font-bold ${
                isNew ? 'bg-zine-mustard text-white' : 'bg-white/90 text-[#2B2623]'
              }`}
            >
              {!open ? releaseDay(ep) : watched ? '✓ смотрел' : 'Новая'}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * Шторка телевизора: все серии (начать с первой, пересмотреть) и старые новости проекта.
 * Сюда попадаешь, когда новых серий нет; есть новая — телевизор сразу её включает
 */
export const SerialSheet: React.FC<{
  serial: SerialState;
  unreadNews: number;
  onOpen: (ep: SerialEpisode) => void;
  onOpenNews: () => void;
  onClose: () => void;
}> = ({ serial, unreadNews, onOpen, onOpenNews, onClose }) => {
  const none = !Object.keys(serial.seen).length;
  return (
    <BottomSheet title="Не Одна Дома" onClose={onClose}>
      <p className="-mt-1 mb-3 text-sm2 text-zine-inkMuted">
        {none ? 'Мини-сериал про нас. Начни с первой серии, это 30 секунд' : 'Мини-сериал про нас · новая серия каждый день'}
      </p>
      <EpisodeRow serial={serial} onOpen={onOpen} />
      <button
        onClick={onOpenNews}
        className="mt-4 w-full h-12 px-3 rounded-zine-sm bg-zine-card flex items-center gap-2 text-left cursor-pointer active:scale-[0.99] transition-transform"
      >
        <span className="flex-1 text-body font-semibold text-zine-ink">Новости проекта</span>
        {unreadNews > 0 && (
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-zine-terracotta text-white text-[12px] font-bold flex items-center justify-center">{unreadNews}</span>
        )}
        <ChevronRight size={18} className="text-zine-inkMuted" />
      </button>
    </BottomSheet>
  );
};

/** Сам телевизор — в шапке и в подсказке в конце первой серии */
export const TvArt: React.FC<{ size: number; fresh?: boolean; className?: string }> = ({ size, fresh = false, className }) => {
  const clip = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className={className} aria-hidden>
      <path d="M15 3 L21 10 M29 3 L23 10" stroke="#2B2623" strokeWidth="2" strokeLinecap="round" />
      <rect x="3" y="10" width="38" height="31" rx="8" fill="#D95C3C" stroke="#2B2623" strokeWidth="2" />
      <clipPath id={clip}>
        <rect x="7" y="14" width="24" height="23" rx="5" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect x="7" y="14" width="24" height="23" fill="#F6E2BD" />
        <svg x="7" y="14" width="24" height="23" viewBox="50 54 100 96" preserveAspectRatio="xMidYMid slice">
          <use href="#vasya" />
          <use href={fresh ? '#v-open' : '#v-smile'} />
        </svg>
      </g>
      <rect x="7" y="14" width="24" height="23" rx="5" fill="none" stroke="#2B2623" strokeWidth="1.5" />
      <circle cx="36" cy="20" r="2" fill="#2B2623" />
      <circle cx="36" cy="27" r="2" fill="#2B2623" />
    </svg>
  );
};

/**
 * Телевизор с Василисой — вход в сериал и новости, в шапке каждой вкладки.
 * Есть непросмотренная серия — вокруг кольцо как у сторис и точка, нажатие сразу включает серию
 */
export const SerialTv: React.FC<{ serial: SerialState; unreadNews: number; size?: number; onClick: () => void }> = ({
  serial,
  unreadNews,
  size = 40,
  onClick
}) => {
  const fresh = !!serial.waiting;
  const label = fresh ? `Не Одна Дома: новая серия ${serial.waiting!.n}` : unreadNews > 0 ? `Сериал и новости: ${unreadNews} новых` : 'Сериал и новости';
  return (
    <button
      onClick={() => {
        telegramService.haptic('selection');
        onClick();
      }}
      aria-label={label}
      className="serial relative shrink-0 grid place-items-center cursor-pointer active:scale-95 transition-transform"
      style={{ width: size, height: size }}
    >
      {fresh && <span aria-hidden className="absolute inset-0 rounded-[14px] p-[2px] bg-[conic-gradient(#D95C3C,#E2A03F,#D95C3C)] serial-tv-ring" />}
      {fresh && <span aria-hidden className="absolute inset-[2px] rounded-[12px] bg-zine-paper" />}
      <TvArt size={size - 6} fresh={fresh} className="relative" />
      {(fresh || unreadNews > 0) && (
        <span aria-hidden className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-zine-terracotta ring-2 ring-zine-paper" />
      )}
    </button>
  );
};

/** Шапки вкладок берут телевизор отсюда — не тянуть пропсы через каждый экран */
const TvContext = createContext<React.ReactNode>(null);
export const SerialTvProvider = TvContext.Provider;
export const useSerialTv = () => useContext(TvContext);
export const SerialTvSlot: React.FC<{ size?: number; fallback?: React.ReactNode }> = ({ size, fallback = null }) => {
  const tv = useContext(TvContext);
  if (!tv) return <>{fallback}</>;
  return <>{size && isValidElement(tv) ? cloneElement(tv as React.ReactElement<{ size?: number }>, { size }) : tv}</>;
};

export { EPISODES };
