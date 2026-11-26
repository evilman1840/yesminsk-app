import { Bell, CalendarDays, Heart, Layers, LocateFixed, MapPin, SlidersHorizontal, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { telegramService } from '../../services/telegram';
import type { MapMode } from '../../screens/MapScreen';
import { thumb, NO_PHOTO } from '../../utils/thumb';

const headerControl = 'grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-[0.98] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta';

export function MapStatusButton({ avatarUrl, active, pulse, onOpen }: {
  avatarUrl?: string;
  active: boolean;
  pulse: boolean;
  onOpen: () => void;
}) {
  return <button type="button" onClick={() => { telegramService.haptic('light'); onOpen(); }}
    aria-label={active ? 'Я сейчас: изменить активный статус' : 'Я сейчас: добавить статус'} className={headerControl}>
    <span className="relative h-[38px] w-[38px] shrink-0">
      <img src={thumb(avatarUrl) || NO_PHOTO} alt="" className="h-full w-full rounded-full border border-zine-border bg-zine-card object-cover" />
      <span aria-hidden className={`absolute bottom-0 right-0 grid place-items-center rounded-full ring-2 ring-zine-paper ${active ? 'h-2.5 w-2.5 bg-zine-sage' : 'h-4 w-4 bg-zine-terracotta text-xs font-bold leading-none text-white'}`}>
        {(active || pulse) && <span className={`pointer-events-none absolute inset-0 rounded-full motion-safe:animate-ping [animation-duration:2.4s] ${active ? 'bg-zine-sage/70' : 'bg-zine-terracotta/75 [animation-iteration-count:3]'}`} />}
        {!active && <span className="relative">?</span>}
      </span>
    </span>
  </button>;
}

export function MapNotificationsButton({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  return <button type="button" onClick={() => { telegramService.haptic('light'); onOpen(); }}
    aria-label={unread > 0 ? `Уведомления и новости, новых: ${unread}` : 'Уведомления и новости'} className={headerControl}>
    <span aria-hidden className="relative grid h-9 w-9 place-items-center rounded-full border border-zine-border bg-zine-cardElevated text-zine-inkMuted">
      <Bell size={17} />
      {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-zine-terracotta ring-1 ring-zine-cardElevated" />}
    </span>
  </button>;
}

export function MapQuickControls({ onDonate, onLocate, locating }: {
  onDonate?: () => void;
  onLocate: () => void;
  locating: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return <>
    {onDonate && <button type="button"
      onClick={() => { telegramService.haptic('light'); onDonate(); }} aria-label="Донат проекту"
      className="absolute bottom-14 left-4 z-20 isolate flex min-h-12 items-center gap-2 overflow-hidden rounded-full border border-zine-paper/20 bg-zine-ink px-4 text-sm2 font-bold text-white shadow-lg shadow-zine-ink/25 dark:border-zine-blush/60 dark:bg-zine-cardElevated dark:shadow-zine-blush/20 dark:ring-1 dark:ring-zine-ink/15 transition-transform active:scale-[0.95] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zine-ink">
      {!reducedMotion && <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-full"
        initial={{ x: '-100%' }} animate={{ x: '200%' }}
        transition={{ duration: 0.85, delay: 4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 6.65 }}>
        <span className="absolute -inset-y-3 left-0 w-1/3 -skew-x-[22deg] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </motion.span>}
      <motion.span aria-hidden className="relative"
        animate={reducedMotion ? { scale: 1 } : { scale: [1, 1.16, 1, 1.1, 1] }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.62, delay: 2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 5.38 }}>
        <Heart size={21} className="fill-zine-terracotta text-zine-terracotta" />
      </motion.span>
      <span className="relative">Донат</span>
    </button>}
    <button type="button" onClick={onLocate} disabled={locating} title="Где я?" aria-label="Показать, где я" aria-busy={locating}
      className="absolute bottom-14 right-4 z-20 grid h-12 w-12 place-items-center rounded-full border border-zine-border bg-zine-cardElevated text-zine-inkMuted shadow-zine focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta disabled:opacity-60">
      <LocateFixed size={24} className={locating ? 'motion-safe:animate-spin' : ''} />
    </button>
  </>;
}

const mapTabs = [
  ['all', Layers, 'Всё'],
  ['people', Users, 'Люди'],
  ['events', CalendarDays, 'Сходки'],
  ['places', MapPin, 'Места'],
] as const;
const tap = 'transition-transform active:scale-[0.97] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta';

export function MapFiltersBar({ value, activeFilters, onChange, onOpenFilters }: {
  value: MapMode;
  activeFilters: number;
  onChange: (mode: MapMode) => void;
  onOpenFilters: () => void;
}) {
  return <div className="flex items-center gap-2">
    <div role="group" aria-label="Что показывать на карте"
      className="grid min-w-0 flex-1 grid-cols-4 gap-0.5 rounded-full border border-zine-border bg-zine-cardElevated p-0.5 shadow-zine">
      {mapTabs.map(([mode, Icon, label]) => {
        const active = value === mode;
        return <button type="button" key={mode} aria-pressed={active}
          onClick={() => { if (!active) { telegramService.haptic('light'); onChange(mode); } }}
          className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-full px-0.5 text-cap font-bold ${tap} ${active ? 'bg-zine-terracotta/15 text-zine-ink' : 'text-zine-inkMuted'}`}>
          <Icon aria-hidden size={15} className="hidden shrink-0 min-[400px]:block" />
          {label}
        </button>;
      })}
    </div>
    {(value === 'all' || value === 'people') && (
      <button type="button" onClick={() => { telegramService.haptic('light'); onOpenFilters(); }}
        aria-label={activeFilters > 0 ? `Фильтры: ${activeFilters}` : 'Фильтры'}
        className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-zine-border bg-zine-cardElevated text-zine-ink shadow-zine ${tap}`}>
        <span className={`grid h-9 w-9 place-items-center rounded-full ${activeFilters > 0 ? 'bg-zine-terracotta/15' : 'bg-zine-card'}`}><SlidersHorizontal aria-hidden size={19} /></span>
        {activeFilters > 0 && <span aria-hidden className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-zine-paper bg-zine-terracotta px-1 text-xs font-bold leading-none text-white">{activeFilters}</span>}
      </button>
    )}
  </div>;
}
