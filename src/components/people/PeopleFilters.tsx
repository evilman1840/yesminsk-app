import React from 'react';
import { UserProfile, PreferredGender, AgeRange, isAvailableNow, GoesWith, GOES_WITH, GoalFilter } from '../../types';
import { telegramService } from '../../services/telegram';
import { BottomSheet } from '../ui/BottomSheet';
import { GoalChips } from '../ui/GoalChips';

/**
 * Фильтры в «Людях»: цель встречи, пол, возраст, расстояние, «Могу сейчас», местные/туристы, «были недавно»
 * и учёт моих предпочтений из анкеты. Выбор запоминается на устройстве.
 */

export type AgeBucket = '18-25' | '26-35' | '36-50' | '50+';

export interface PeopleFilters {
  gender: 'all' | 'male' | 'female';
  ages: AgeBucket[];          // пусто — любой возраст
  maxKm: 0 | 1 | 3 | 10;      // 0 — весь Минск
  availableOnly: boolean;
  who: 'all' | 'locals' | 'tourists';
  recentOnly: boolean;
  goesWith: GoesWith[];       // «Обычно ходит»; пусто — любые
  useMyPrefs: boolean;
}

export const DEFAULT_FILTERS: PeopleFilters = {
  gender: 'all',
  ages: [],
  maxKm: 0,
  availableOnly: false,
  who: 'all',
  recentOnly: false,
  goesWith: [],
  useMyPrefs: true
};

const STORAGE_KEY = 'yesminsk_people_filters';

export const loadFilters = (): PeopleFilters => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return saved ? { ...DEFAULT_FILTERS, ...saved } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
};

export const saveFilters = (f: PeopleFilters) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    // без сохранения фильтры просто сбросятся при следующем запуске
  }
};

// Сколько фильтров отличается от «по умолчанию» — число на кнопке
export const countActiveFilters = (f: PeopleFilters) =>
  Number(f.gender !== 'all') +
  Number(f.ages.length > 0) +
  Number(f.maxKm !== 0) +
  Number(f.availableOnly) +
  Number(f.who !== 'all') +
  Number(f.recentOnly) +
  Number(f.goesWith.length > 0) +
  Number(!f.useMyPrefs);

const AGE_BUCKETS: { id: AgeBucket; min: number; max: number }[] = [
  { id: '18-25', min: 0, max: 25 },
  { id: '26-35', min: 26, max: 35 },
  { id: '36-50', min: 36, max: 50 },
  { id: '50+', min: 51, max: 200 }
];

// «Возраст компании 18–45» раньше сохранялся сам — считаем, что человек его не задавал
const isLegacyAgeRange = (r?: AgeRange) => !r || (r.min === 18 && r.max === 45);

export interface MyPrefs {
  preferredGender?: PreferredGender;
  preferredAgeRange?: AgeRange;
}

export const applyPeopleFilters = (users: UserProfile[], f: PeopleFilters, my: MyPrefs) =>
  users.filter((u) => {
    if (f.gender !== 'all' && u.gender !== f.gender) return false;
    if (f.ages.length > 0) {
      const age = Number(u.age) || 0;
      if (!AGE_BUCKETS.some((b) => f.ages.includes(b.id) && age >= b.min && age <= b.max)) return false;
    }
    if (f.maxKm && (u.distanceMeters ?? Infinity) > f.maxKm * 1000) return false;
    if (f.availableOnly && !isAvailableNow(u)) return false;
    if (f.who === 'locals' && u.isTourist) return false;
    if (f.who === 'tourists' && !u.isTourist) return false;
    if (f.recentOnly && !u.activeRecently) return false;
    if (f.goesWith.length > 0 && (!u.goesWith || !f.goesWith.includes(u.goesWith))) return false;
    if (f.useMyPrefs) {
      if (my.preferredGender && my.preferredGender !== 'all' && u.gender !== my.preferredGender) return false;
      const r = my.preferredAgeRange;
      if (r && !isLegacyAgeRange(r) && (Number(u.age) < r.min || Number(u.age) > r.max)) return false;
    }
    return true;
  });

/* ---------- Шторка ---------- */

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={() => {
      telegramService.haptic('selection');
      onClick();
    }}
    className={`h-11 px-4 rounded-full text-sm2 font-semibold border transition-colors cursor-pointer ${
      active ? 'bg-zine-ink text-zine-paper border-zine-ink' : 'bg-zine-cardElevated text-zine-ink border-zine-border'
    }`}
  >
    {children}
  </button>
);

const Toggle: React.FC<{ title: string; hint: string; value: boolean; onChange: (v: boolean) => void }> = ({ title, hint, value, onChange }) => (
  <button
    type="button"
    onClick={() => {
      telegramService.haptic('selection');
      onChange(!value);
    }}
    className="w-full py-3 flex items-center justify-between gap-3 text-left cursor-pointer"
  >
    <span>
      <span className="block text-body font-bold text-zine-ink">{title}</span>
      <span className="block text-sm2 text-zine-inkMuted">{hint}</span>
    </span>
    <span className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${value ? 'bg-zine-sage' : 'bg-zine-border'}`}>
      <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </span>
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="py-3">
    <p className="mb-2.5 text-body font-bold text-zine-ink">{title}</p>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

export const PeopleFiltersSheet: React.FC<{
  value: PeopleFilters;
  onChange: (f: PeopleFilters) => void;
  goal?: GoalFilter;           // цель встречи хранится в App; на карте у неё свои чипы — там не передают
  onGoalChange?: (goal: GoalFilter) => void;
  resultCount: number;
  onClose: () => void;
}> = ({ value: f, onChange, goal, onGoalChange, resultCount, onClose }) => {
  const set = (patch: Partial<PeopleFilters>) => onChange({ ...f, ...patch });
  const toggleAge = (id: AgeBucket) => set({ ages: f.ages.includes(id) ? f.ages.filter((a) => a !== id) : [...f.ages, id] });

  return (
    <BottomSheet title="Фильтры" onClose={onClose}>
      <div className="divide-y divide-zine-border">
        {goal && onGoalChange && (
          <div className="py-3">
            <p className="mb-2.5 text-body font-bold text-zine-ink">Чем заняться</p>
            <GoalChips value={goal} onChange={onGoalChange} wrapperClassName="flex flex-wrap gap-2" />
          </div>
        )}

        <Section title="Пол">
          <Chip active={f.gender === 'all'} onClick={() => set({ gender: 'all' })}>Все</Chip>
          <Chip active={f.gender === 'male'} onClick={() => set({ gender: 'male' })}>Мужчины</Chip>
          <Chip active={f.gender === 'female'} onClick={() => set({ gender: 'female' })}>Женщины</Chip>
        </Section>

        <Section title="Возраст">
          <Chip active={f.ages.length === 0} onClick={() => set({ ages: [] })}>Любой</Chip>
          {AGE_BUCKETS.map((b) => (
            <Chip key={b.id} active={f.ages.includes(b.id)} onClick={() => toggleAge(b.id)}>
              {b.id}
            </Chip>
          ))}
        </Section>

        <Section title="Расстояние">
          {([1, 3, 10, 0] as const).map((km) => (
            <Chip key={km} active={f.maxKm === km} onClick={() => set({ maxKm: km })}>
              {km ? `До ${km} км` : 'Весь Минск'}
            </Chip>
          ))}
        </Section>

        <Section title="Обычно ходит">
          <Chip active={f.goesWith.length === 0} onClick={() => set({ goesWith: [] })}>Любые</Chip>
          {(Object.keys(GOES_WITH) as GoesWith[]).map((g) => (
            <Chip
              key={g}
              active={f.goesWith.includes(g)}
              onClick={() => set({ goesWith: f.goesWith.includes(g) ? f.goesWith.filter((x) => x !== g) : [...f.goesWith, g] })}
            >
              {GOES_WITH[g].emoji} {GOES_WITH[g].label}
            </Chip>
          ))}
        </Section>

        <Section title="Кто">
          <Chip active={f.who === 'all'} onClick={() => set({ who: 'all' })}>Все</Chip>
          <Chip active={f.who === 'locals'} onClick={() => set({ who: 'locals' })}>Местные</Chip>
          <Chip active={f.who === 'tourists'} onClick={() => set({ who: 'tourists' })}>🧳 Туристы</Chip>
        </Section>

        <div className="py-1">
          <Toggle title="⚡ Только «Могу сейчас»" hint="Кому удобно встретиться в ближайшие часы" value={f.availableOnly} onChange={(v) => set({ availableOnly: v })} />
          <Toggle title="Были недавно" hint="Заходили в приложение за последние 3 дня" value={f.recentOnly} onChange={(v) => set({ recentOnly: v })} />
          <Toggle
            title="Учитывать мои предпочтения"
            hint="«С кем комфортно» и «Возраст компании» из твоей анкеты"
            value={f.useMyPrefs}
            onChange={(v) => set({ useMyPrefs: v })}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
        <button
          onClick={() => {
            onChange({ ...DEFAULT_FILTERS });
            onGoalChange?.('all');
          }}
          className="h-12 px-5 rounded-zine-sm bg-zine-card text-zine-ink text-body font-semibold cursor-pointer"
        >
          Сбросить
        </button>
        <button onClick={onClose} className="h-12 rounded-zine-sm bg-zine-terracotta text-white text-body font-bold cursor-pointer">
          {resultCount > 0 ? `Показать (${resultCount})` : 'Никого не нашлось'}
        </button>
      </div>
    </BottomSheet>
  );
};
