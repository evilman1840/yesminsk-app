import React from 'react';
import { Questionnaire, PERSONAL_QUESTIONS } from './questionnaire';
const entries = [['intentions','Ищу'], ['activities','Позови меня на'], ['companySizes','Компания'], ['restStyles','Ритм встречи'], ['availability','Когда удобно'], ['meetingAreas','Где удобно встречаться'], ['budget','Бюджет на себя'], ['topics','Люблю поговорить о'], ['wants','Хочу'], ['offers','Могу']];
export function QuestionnaireSummary({ value }: { value?: Questionnaire }) {
  if (!value) return null;
  const has = entries.some(([k]) => value[k]?.length);
  const personal = PERSONAL_QUESTIONS.filter(f => value.personal?.[f.key]?.visible === true && value.personal[f.key].values.length);
  if (!has && !personal.length) return null;
  return <div className="mt-5 space-y-4 border-t border-zine-border pt-4">
    {entries.map(([key,title]) => value[key]?.length ? <section key={key}><h4 className="text-cap font-bold uppercase tracking-wide text-zine-inkMuted mb-2">{title}</h4><p className="text-body whitespace-pre-line">{value[key].map((a: string) => a === value.favouriteActivity ? `★ ${a}` : a).join(' · ')}</p>{key === 'wants' && value.wantDetails && <p className="mt-1 text-sm2 text-zine-inkMuted whitespace-pre-line">{value.wantDetails}</p>}{key === 'offers' && value.offerDetails && <p className="mt-1 text-sm2 text-zine-inkMuted whitespace-pre-line">{value.offerDetails}</p>}</section> : null)}
    {personal.length > 0 && <details><summary className="min-h-11 py-2 text-body font-bold cursor-pointer">Чуть ближе · {personal.length}</summary>{personal.map(f => <section key={f.key} className="my-3"><h4 className="text-sm2 font-semibold">{f.title}</h4><p className="mt-1 text-body">{value.personal[f.key].values.join(' · ')}</p></section>)}</details>}
  </div>;
}
