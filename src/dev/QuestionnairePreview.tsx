import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { ProfileFormScreen } from '../screens/ProfileFormScreen';
import { ProfileInviteBanner } from '../profile/ProfileInviteBanner';
import { UserBottomSheet } from '../components/common/UserBottomSheet';
import { Questionnaire } from '../profile/questionnaire';
import { UserProfile } from '../types';
const q: Questionnaire = { version: 1, intentions: ['Друзей для регулярного общения'], activities: ['Кофе и разговоры','Настольные игры'], meetingAreas: ['Весь Минск','Боровляны','Колодищи'], personal: { alcohol: { values: ['Хочу встречи без алкоголя'], visible: false } } };
// This isolated page has no production environment file and never sends data to a server.
const originalFetch = window.fetch.bind(window);
window.fetch = (input, opts) => String(input).startsWith('http://localhost:4000') ? Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } })) : originalFetch(input, opts);
function Preview() {
 const [screen, setScreen] = useState('profile'); const [width,setWidth] = useState(390); const [dark,setDark] = useState(false); const [saved,setSaved] = useState(false);
 const [data,setData] = useState<any>({ name:'Саша',age:'29',ageConfirmed:true,gender:'not_specified' as const,genderConfirmed:true,profileCompleted:true,bio:'Люблю кофе и настолки. Покажу любимые места.',goals:['walk','boardgames'] as any,area:'Боровляны',avatarUrl:'/misha-questionnaire-v1.jpg',questionnaire:q,username:'example' });
 const user: UserProfile = { id:'1',telegramId:1,firstName:data.name,age:29,gender:'not_specified',avatarUrl:data.avatarUrl,bio:data.bio,goal:'walk',goals:data.goals,areaName:data.area,coordinates:[53.9,27.5],preferredGender:'all',preferredAgeRange:{min:18,max:99},hostedCount:12,hostActive:true,isSupporter:true,isGuide:true,isEmpath:true,questionnaire:data.questionnaire };
 return <main className="p-3 bg-zine-paper text-zine-ink min-h-screen"><div className="flex flex-wrap gap-2 mb-3">{['profile','banner','public'].map(s=><button key={s} className="min-h-11 border border-zine-border px-3" onClick={()=>setScreen(s)}>{s}</button>)}<select aria-label="Ширина" value={width} onChange={e=>setWidth(Number(e.target.value))}>{[360,390,430].map(w=><option key={w}>{w}</option>)}</select><button className="min-h-11 px-3" onClick={()=>{document.documentElement.classList.toggle('dark');setDark(!dark)}}>{dark?'Светлая':'Тёмная'}</button><span>{saved?'Сохранено в предпросмотре':''}</span></div><div style={{width:`min(100%,${width}px)`,height:760,margin:'auto',border:'1px solid rgb(var(--c-border))'}}>{screen==='profile'&&<ProfileFormScreen initialData={data} focusQuestionnaire={new URLSearchParams(location.search).has('focus')} onSave={async next=>{setData(v=>({...v,...next}));setSaved(true)}} />}</div>{screen==='banner'&&<ProfileInviteBanner onSeen={()=>{}} onClose={()=>setScreen('profile')} onContinue={()=>setScreen('profile')}/>} {screen==='public'&&<UserBottomSheet user={user} onClose={()=>setScreen('profile')} onReact={()=>{}} onReported={()=>{}} />}</main>;
}
if(import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview/>);
