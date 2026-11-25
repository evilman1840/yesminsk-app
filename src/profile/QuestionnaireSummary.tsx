import React from 'react';
import { Questionnaire, PERSONAL_QUESTIONS } from './questionnaire';

type Activity = { label: string; emoji?: string };
const meetingFields = [
  ['companySizes', 'Компания', '👥'], ['restStyles', 'Ритм', '🌿'],
  ['availability', 'Когда', '🗓️'], ['meetingAreas', 'Где', '📍'], ['budget', 'Бюджет на себя', '🎟️']
];
const activityEmoji: Record<string, string> = {
  'Прогулки по городу': '🚶', 'Кофе и разговоры': '☕', 'Кафе и рестораны': '🍽️',
  'Настольные игры': '🎲', 'Кино': '🎬', 'Выставки и музеи': '🖼️', 'Театр и выступления': '🎭',
  'Концерты': '🎵', 'Бары': '🍹', 'Вечеринки и танцы': '🪩', 'Спорт и тренировки': '🏃',
  'Велосипед': '🚲', 'Походы и прогулки на природе': '🌲', 'Поездки за город': '🚌',
  'Прогулки с собаками': '🐾', 'Творческие занятия и мастер-классы': '🎨', 'Новые и необычные занятия': '✨'
};

// Only presentation changes; saved answers and matching still use the full catalogue labels.
const compactActivity: Record<string, string> = {
  'Настольные игры': 'Настолки', 'Прогулки по городу': 'Прогулки',
  'Творческие занятия и мастер-классы': 'Творчество и мастер-классы',
  'Походы и прогулки на природе': 'Походы и природа',
  'Спорт и тренировки': 'Спорт', 'Вечеринки и танцы': 'Танцы и вечеринки',
  'Новые и необычные занятия': 'Попробовать новое'
};

/** Detailed answers replace the old broad categories in the public activity list. */
export function QuestionnaireSummary({ value, fallbackActivities = [] }: { value?: Questionnaire; fallbackActivities?: Activity[] }) {
  const q: Questionnaire = value || { version: 1 };
  const activities: Activity[] = q.activities?.length
    ? q.activities.map(label => ({ label, emoji: activityEmoji[label] || '✨' }))
    : fallbackActivities;
  const ordered = [...activities].sort((a, b) => Number(b.label === q.favouriteActivity) - Number(a.label === q.favouriteActivity));
  const personal = PERSONAL_QUESTIONS.filter(f => q.personal?.[f.key]?.visible === true && q.personal[f.key].values.length);
  if (!activities.length && !meetingFields.some(([key]) => q[key]?.length)
    && !['intentions', 'topics', 'wants', 'offers'].some(key => q[key]?.length) && !personal.length) return null;

  return <div className="mt-4 space-y-3 text-zine-ink break-words">
    {ordered.length > 0 && <section className="rounded-zine border border-zine-mustard/30 bg-zine-mustard/10 p-3">
      <h4 className="font-serif text-body font-bold mb-2">Позови меня на</h4>
      <ul className="flex flex-wrap gap-1.5">
        {ordered.map(({ label, emoji }) => <li key={label} aria-label={label === q.favouriteActivity ? `Любимое: ${label}` : label} className={`max-w-full rounded-full border px-2 py-1 text-sm2 ${label === q.favouriteActivity ? 'bg-zine-terracotta/10 border-zine-terracotta/35 font-bold' : 'bg-zine-cardElevated border-zine-mustard/20'}`}>
          {label === q.favouriteActivity && <span aria-hidden="true">★ </span>}
          <span aria-hidden="true">{emoji} </span>{compactActivity[label] || label}
        </li>)}
      </ul>
    </section>}

    {!!q.intentions?.length && <section className="border-l-[3px] border-zine-sage pl-3">
      <h4 className="text-cap font-bold text-zine-inkMuted mb-1">Ищу здесь</h4>
      <p className="text-sm2">{q.intentions.join(' · ')}</p>
    </section>}

    {meetingFields.some(([key]) => q[key]?.length) && <section>
      <h4 className="font-serif text-body font-bold mb-2">Для встречи</h4>
      <dl className="rounded-zine border border-zine-border bg-zine-card/60 divide-y divide-zine-border">
        {meetingFields.map(([key, title, emoji]) => q[key]?.length ? <div key={key} className="grid grid-cols-[86px_minmax(0,1fr)] gap-x-2 px-3 py-2">
          <dt className="text-cap text-zine-inkMuted font-semibold leading-[21px]"><span aria-hidden="true">{emoji} </span>{title}</dt>
          <dd className="min-w-0 text-sm2">{q[key].join(' · ')}</dd>
        </div> : null)}
      </dl>
    </section>}

    {!!q.topics?.length && <section>
      <h4 className="font-serif text-body font-bold mb-2">Есть о чём поговорить</h4>
      <p className="border-l-[3px] border-zine-plum/40 pl-3 text-sm2">{q.topics.join(' · ')}</p>
    </section>}

    {([['wants', 'Хочу', 'wantDetails'], ['offers', 'Могу', 'offerDetails']] as const).map(([key, title, details]) => q[key]?.length ? <section key={key} className="rounded-zine bg-zine-sage/10 border border-zine-sage/20 px-3 py-2.5">
      <h4 className="font-serif text-lead font-bold mb-2">{title}</h4>
      <p className="text-sm2">{q[key].join(' · ')}</p>
      {q[details] && <p className="mt-2 text-sm2 whitespace-pre-line">{q[details]}</p>}
    </section> : null)}

    {personal.length > 0 && <details className="rounded-zine border border-zine-border px-3 py-1">
      <summary className="min-h-11 py-2 text-body font-bold cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">Чуть ближе · {personal.length}</summary>
      {personal.map(f => <section key={f.key} className="py-2 border-t border-zine-border"><h4 className="text-sm2 font-semibold">{f.title}</h4><p className="mt-1 text-sm2">{q.personal![f.key].values.join(' · ')}</p></section>)}
    </details>}
  </div>;
}
