import { track } from '../analytics/runtime';
import React, { useEffect, useRef, useState } from 'react';
import { AREA_GROUPS } from '../config/areas';
import { telegramService } from '../services/telegram';
import { CORE_QUESTIONS, EXTRA_QUESTIONS, PERSONAL_QUESTIONS, ChoiceQuestion, Questionnaire, questionnaireCount } from './questionnaire';

const selectedStyle = 'border-zine-terracotta bg-zine-terracotta/10 text-zine-ink';
const idleStyle = 'border-zine-border bg-zine-cardElevated text-zine-ink';
export function QuestionnaireEditor({ value, onChange, focus }: { value: Questionnaire; onChange: (q: Questionnaire) => void; focus?: boolean }) {
  const edited = useRef(false);
  const root = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  useEffect(() => { if (focus && root.current) { root.current.open = true; root.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, [focus]);
  const patch = (p: Partial<Questionnaire>) => { if(!edited.current){edited.current=true;track('gulyai_questionnaire_started');} onChange({ ...value, ...p, version: 1 }); };
  const toggle = (f: ChoiceQuestion, answer: string, personal = false) => {
    const before: string[] = personal ? value.personal?.[f.key]?.values || [] : value[f.key] || [];
    let next = before.includes(answer) ? before.filter(x => x !== answer) : f.max === 1 || answer === f.exclusive ? [answer] : [...before.filter(x => x !== f.exclusive), answer];
    if (f.key === 'meetingAreas') {
      const suburb = Object.keys(AREA_GROUPS.find(g => g.title === 'Рядом с Минском')!.areas).includes(answer);
      if (answer === 'Весь Минск' && next.includes(answer)) {
        const suburbs = Object.keys(AREA_GROUPS.find(g => g.title === 'Рядом с Минском')!.areas);
        next = next.filter(x => x === 'Весь Минск' || suburbs.includes(x));
      } else if (!suburb) next = next.filter(x => x !== 'Весь Минск');
    }
    if (next.length > f.max) { setLimitMessage(`Здесь можно выбрать до ${f.max} вариантов. Сними один из выбранных.`); telegramService.haptic('warning'); return; }
    setLimitMessage(''); telegramService.haptic('selection');
    if (personal) patch({ personal: { ...value.personal, [f.key]: { values: next, visible: value.personal?.[f.key]?.visible === true } } });
    else patch({ [f.key]: next, ...(f.key === 'activities' && !next.includes(value.favouriteActivity) ? { favouriteActivity: '' } : {}) });
  };
  const field = (f: ChoiceQuestion, personal = false) => {
    const answers: string[] = personal ? value.personal?.[f.key]?.values || [] : value[f.key] || [];
    const choice = (a: string) => <button key={a} type="button" aria-pressed={answers.includes(a)} onClick={() => toggle(f, a, personal)} className={`min-h-11 px-3 py-2 rounded-zine-sm border text-left text-sm2 font-semibold ${answers.includes(a) ? selectedStyle : idleStyle}`}>{answers.includes(a) ? '✓ ' : ''}{a}</button>;
    return <details key={f.key} className="border-t border-zine-border py-1">
      <summary className="min-h-14 py-3 cursor-pointer text-body font-bold"><span>{f.title}</span><span className="block mt-1 text-sm2 font-normal text-zine-inkMuted">{answers.length ? answers.join(' · ') : 'Можно пропустить'}</span></summary>
      <p className="mb-3 text-sm2 text-zine-inkMuted">{f.max === 1 ? 'Один ответ' : f.key === 'meetingAreas' ? 'Несколько мест. «Весь Минск» не включает пригороды.' : `До ${f.max} вариантов`}{f.key === 'budget' ? '. Расходы на себя: билеты, еда и другие обязательные траты.' : ''}{['appearanceSelf','intelligenceSelf'].includes(f.key) ? '. 1: низкая самооценка, 10: высокая. Это не рейтинг людей.' : ''}</p>
      {f.key === 'meetingAreas' ? <>
        <label className="block text-sm2 mb-2">Найти район или пригород<input className="field mt-1" value={search} onChange={e => setSearch(e.target.value)} placeholder="Например, Боровляны" /></label>
        {choice('Весь Минск')}
        {AREA_GROUPS.map(g => { const matches = Object.keys(g.areas).filter(a => a.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))); return matches.length ? <div key={g.title} className="mt-4"><p className="text-sm2 font-bold mb-2">{g.title}</p><div className="flex flex-wrap gap-2">{matches.map(choice)}</div></div> : null; })}
        {search && !AREA_GROUPS.some(g => Object.keys(g.areas).some(a => a.toLowerCase().includes(search.toLowerCase()))) && <p className="py-3 text-sm2">Такого места пока нет. Можно выбрать «Другой пригород» или очистить поиск.</p>}
      </> : <div className="flex flex-col gap-2">{f.options.map(choice)}</div>}
      {f.key === 'activities' && answers.length > 0 && <label className="block mt-3 text-sm2 font-semibold">Любимое занятие<select className="field mt-1" value={value.favouriteActivity || ''} onChange={e => patch({ favouriteActivity: e.target.value })}><option value="">Не выделять</option>{answers.map(a => <option key={a}>{a}</option>)}</select></label>}
      {personal && answers.length > 0 && <label className="flex items-center gap-3 min-h-12 mt-3 py-2 text-sm2 font-semibold"><input type="checkbox" checked={value.personal?.[f.key]?.visible === true} onChange={e => patch({ personal: { ...value.personal, [f.key]: { values: answers, visible: e.target.checked } } })} />Показывать этот ответ в анкете</label>}
      {answers.length > 0 && <button type="button" onClick={() => { telegramService.haptic('selection'); if (personal) patch({ personal: { ...value.personal, [f.key]: { values: [], visible: false } } }); else patch({ [f.key]: [], ...(f.key === 'activities' ? { favouriteActivity: '' } : {}) }); }} className="min-h-11 px-2 text-sm2 text-zine-inkMuted underline">{personal ? 'Удалить ответ' : 'Очистить ответ'}</button>}
    </details>;
  };
  return <details ref={root} className="rounded-zine border border-zine-border bg-zine-cardElevated px-4" id="new-questionnaire">
    <summary data-analytics="profile_questionnaire" className="min-h-16 py-4 cursor-pointer"><b className="text-body">Чтобы тебя было проще позвать</b><span className="block text-sm2 text-zine-inkMuted mt-1">{questionnaireCount(value)} из 8 основных ответов · добровольно</span></summary>
    <p className="mb-4 text-sm2 text-zine-inkMuted">Любой вопрос можно пропустить. Основные ответы и «Хочу / Могу» будут видны другим. Сохрани изменения кнопкой «Сохранить».</p>
    {limitMessage && <p role="status" className="p-3 mb-3 bg-zine-card text-sm2">{limitMessage}</p>}
    {CORE_QUESTIONS.map(f => field(f))}
    <h3 className="font-serif font-bold text-title mt-6 mb-2">Хочу / Могу</h3>
    <p className="mb-3 text-sm2 text-zine-inkMuted">Можно заполнить только одну сторону. Обмена услугами не требуется. Ответы и пояснения увидят другие.</p>
    {EXTRA_QUESTIONS.map(f => <React.Fragment key={f.key}>{field(f)}{(value[f.key] || []).length > 0 && <label className="block py-3 text-sm2 font-semibold">{f.key === 'wants' ? 'Что именно хочется? Например, какой спорт или навык' : 'Чем именно можешь поделиться?'}<textarea className="field mt-2" rows={2} maxLength={150} value={value[f.key === 'wants' ? 'wantDetails' : 'offerDetails'] || ''} onChange={e => patch({ [f.key === 'wants' ? 'wantDetails' : 'offerDetails']: e.target.value })} placeholder="Необязательно, до 150 знаков" /></label>}</React.Fragment>)}
    <details className="mt-5 border-t border-zine-border">
      <summary className="min-h-14 py-4 cursor-pointer font-serif text-title font-bold">Чуть ближе <span className="block text-sm2 font-sans font-normal text-zine-inkMuted">10 необязательных вопросов</span></summary>
      <p className="mb-3 text-sm2 text-zine-inkMuted">Ответы скрыты от других пользователей, пока ты не включишь показ у конкретного вопроса. Самооценки не используются как рейтинг. Здесь нет автоматического сравнения людей.</p>
      {PERSONAL_QUESTIONS.map(f => field(f, true))}
    </details>
  </details>;
}
