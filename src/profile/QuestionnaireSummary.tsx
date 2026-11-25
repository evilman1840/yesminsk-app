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

  return <div className="mt-5 space-y-5 text-zine-ink break-words">
    {ordered.length > 0 && <section className="rounded-zine border border-zine-mustard/30 bg-zine-mustard/10 p-4">
      <h4 className="font-serif text-lead font-bold mb-3">Позови меня на</h4>
      <ul className="flex flex-wrap gap-2">
        {ordered.map(({ label, emoji }) => <li key={label} className={`max-w-full rounded-zine-sm border px-3 py-2 text-sm2 ${label === q.favouriteActivity ? 'bg-zine-terracotta/10 border-zine-terracotta/35 font-bold' : 'bg-zine-cardElevated border-zine-mustard/20'}`}>
          {label === q.favouriteActivity && <span className="block mb-1 text-cap text-zine-inkMuted">★ Любимое</span>}
          <span aria-hidden="true">{emoji} </span>{label}
        </li>)}
      </ul>
    </section>}

    {!!q.intentions?.length && <section className="border-l-[3px] border-zine-sage pl-3">
      <h4 className="text-cap font-bold text-zine-inkMuted mb-1">Ищу здесь</h4>
      <p className="text-body">{q.intentions.join(' · ')}</p>
    </section>}

    {meetingFields.some(([key]) => q[key]?.length) && <section>
      <h4 className="font-serif text-lead font-bold mb-3">Для встречи</h4>
      <dl className="rounded-zine border border-zine-border bg-zine-card/60 divide-y divide-zine-border">
        {meetingFields.map(([key, title, emoji]) => q[key]?.length ? <div key={key} className="flex gap-3 p-3">
          <span aria-hidden="true" className="shrink-0 text-lead">{emoji}</span>
          <div className="min-w-0"><dt className="text-cap text-zine-inkMuted font-semibold mb-1">{title}</dt>
            <dd className="text-sm2">{q[key].join(' · ')}</dd></div>
        </div> : null)}
      </dl>
    </section>}

    {!!q.topics?.length && <section>
      <h4 className="font-serif text-lead font-bold mb-3">Есть о чём поговорить</h4>
      <ul className="flex flex-wrap gap-2">{q.topics.map(topic => <li key={topic} className="max-w-full rounded-zine-sm bg-zine-plum/10 border border-zine-plum/20 px-3 py-2 text-sm2">{topic}</li>)}</ul>
    </section>}

    {([['wants', 'Хочу', 'wantDetails'], ['offers', 'Могу', 'offerDetails']] as const).map(([key, title, details]) => q[key]?.length ? <section key={key} className="rounded-zine bg-zine-sage/10 border border-zine-sage/20 p-4">
      <h4 className="font-serif text-lead font-bold mb-2">{title}</h4>
      <ul className="space-y-2">{q[key].map(answer => <li key={answer} className="text-sm2">{answer}</li>)}</ul>
      {q[details] && <p className="mt-3 text-sm2 whitespace-pre-line">{q[details]}</p>}
    </section> : null)}

    {personal.length > 0 && <details className="rounded-zine border border-zine-border p-3">
      <summary className="min-h-11 py-2 text-body font-bold cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-zine-terracotta">Чуть ближе · {personal.length}</summary>
      {personal.map(f => <section key={f.key} className="py-3 border-t border-zine-border"><h4 className="text-sm2 font-semibold">{f.title}</h4><p className="mt-1 text-sm2">{q.personal![f.key].values.join(' · ')}</p></section>)}
    </details>}
  </div>;
}
