import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Bell, Layers, MapPin, Pencil, Plus } from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';
import './mapStatusPreview.css';
import { shortOffer, upperFirst } from '../texts/liveStatus';
import { LiveStatusEditor } from '../components/common/LiveStatus';
import { MapQuickControls, MapStatusButton } from '../components/map/MapControls';

const variants = [
  { name: 'Две строки', hint: 'Хочу и Могу видны вместе.' },
  { name: 'По очереди', hint: 'Одна строка. На карте можно переключить Хочу и Могу.' },
  { name: 'Авто', hint: 'Хочу и Могу сменяются каждые 7 секунд. Можно поставить на паузу.' },
];

const people = [
  { name: 'Лена', label: 'На кофе вечером', can: 'Поболтаю про ИИ', want: 'на кофе вечером', offer: 'поболтать про ИИ', x: 21, y: 26, tone: 'rose' },
  { name: 'Саша', label: 'На прогулку', can: 'Выслушаю', want: 'пройтись после работы', offer: 'выслушать', x: 68, y: 17, tone: 'green' },
  { name: 'Даша', label: 'За обнимашки', can: 'Обсужу мужчин', want: 'обнимашек', offer: 'обсудить мужчин', x: 54, y: 46, tone: 'gold' },
  { name: 'Илья', label: 'На квиз', can: 'Поболтаю про ИИ', want: 'на квиз', offer: 'поболтать про ИИ', x: 22, y: 59, tone: 'blue' },
  { name: 'Катя', label: 'На выставку', can: 'Обниму', want: 'на выставку', offer: 'обнять', x: 78, y: 73, tone: 'rose' },
];

const initialHours = 3;
const hourMs = 3600000;

function MapStatusLines({ want, offer }: { want?: string; offer?: string }) {
  if (!want && !offer) return null;
  return <span className="mp-tag">
    {want && <span>{want}</span>}
    {offer && <span className={want ? 'mp-tag-secondary' : undefined}>{offer}</span>}
  </span>;
}

type Person = typeof people[number];
type Sheet = 'status' | 'person' | 'profile' | 'create' | 'plan' | 'invitePlan' | 'invites' | 'donate' | null;

export function MapStatusPreview() {
  const headerControls = new URLSearchParams(location.search).has('controls');
  useEffect(() => {
    const theme = new URLSearchParams(location.search).get('theme');
    if (theme !== 'light' && theme !== 'dark') return;
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.toggle('dark', theme === 'dark');
    return () => { root.classList.toggle('dark', wasDark); };
  }, []);
  const [statusOpened, setStatusOpened] = useState(false);
  const [located, setLocated] = useState(false);
  const [variant, setVariant] = useState(0);
  const [tab, setTab] = useState<'map' | 'people' | 'events'>('map');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [person, setPerson] = useState(people[0]);
  const [want, setWant] = useState('погулять вечером');
  const [offer, setOffer] = useState('выслушать');
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + initialHours * hourMs);
  const [reducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [showCan, setShowCan] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => {
      setWant('');
      setOffer('');
      setExpiresAt(0);
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  const [activity, setActivity] = useState('Прогулка');
  const [when, setWhen] = useState('19:00');
  const [where, setWhere] = useState('Боровляны');
  const [seats, setSeats] = useState('2');
  const [personal, setPersonal] = useState(false);
  const [nearby, setNearby] = useState(false);
  const [published, setPublished] = useState(false);
  const [response, setResponse] = useState('');
  const [noticeRead, setNoticeRead] = useState(false);
  const [dense, setDense] = useState(true);

  useEffect(() => {
    if (variant !== 2 || paused || sheet || tab !== 'map' || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setShowCan(value => !value);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [variant, paused, sheet, tab, reducedMotion]);

  const openStatus = () => { setStatusOpened(true); setSheet('status'); };
  const openPerson = (p: Person) => { setPerson(p); setSheet('person'); };
  const close = () => setSheet(null);
  const ownPlan = published && sheet === 'plan';
  const planName = published ? activity : 'Кофе';
  const planTime = published ? when : '19:00';

  return <main className="mp-shell">
    <Toaster position="top-center" />
    <header className="mp-head">
      <div><p className="mp-kicker">ГУЛЯЙ! · Прототип</p><h1>Карта живых планов</h1></div>
      {headerControls ? <MapStatusButton avatarUrl="/misha-questionnaire-v1.jpg" active={Boolean(expiresAt)}
        unread={noticeRead ? 0 : 2} pulse={!statusOpened} onOpen={openStatus} /> : <button className="mp-icon mp-bell" aria-label="Приглашения" onClick={() => { setNoticeRead(true); setSheet('invites'); }}><Bell size={21} />{!noticeRead && <i />}</button>}
    </header>
    <div className="mp-variants" aria-label="Варианты карты">
      {variants.map((v, i) => <button key={v.name} aria-pressed={variant === i} onClick={() => { setVariant(i); setShowCan(false); setPaused(false); setTab('map'); }}>{v.name}</button>)}
    </div>
    <p className="mp-hint">{variants[variant].hint}</p>
    {tab === 'map' && variant !== 0 && <div className="mp-page-controls">
      <button aria-pressed={!showCan} onClick={() => { setShowCan(false); setPaused(true); }}>Хочу</button>
      <button aria-pressed={showCan} onClick={() => { setShowCan(true); setPaused(true); }}>Могу</button>
      {variant === 2 && !reducedMotion && <button onClick={() => setPaused(!paused)}>{paused ? 'Продолжить' : 'Пауза'}</button>}
    </div>}
    {tab === 'map' && <div className="mp-map" aria-label="Схема карты Боровлян">
      <div className="mp-park" /><div className="mp-lake" />
      {[[-10,22,17],[8,51,-23],[-15,74,12],[5,33,68],[42,66,-53]].map(([x,y,a], i) =>
        <span className="mp-road" key={i} style={{left: x+'%',top:y+'%',transform:'rotate('+a+'deg)'}} />)}
      <span className="mp-map-name">Боровляны</span>
      <span className="mp-park-name">Лесопарк</span>
      {(dense ? people : people.slice(0, 2)).map(p => <button key={p.name} className={'mp-pin mp-pin-'+p.tone+' '+(p.x > 65 ? 'mp-pin-left' : '')} style={{left:p.x+'%',top:p.y+'%'}} aria-label={p.name+' — открыть статусы'} onClick={() => openPerson(p)}>
        <span className="mp-avatar">{p.name[0]}</span>
        <MapStatusLines want={variant === 0 || !showCan ? p.label : undefined} offer={variant === 0 || showCan ? p.can : undefined} />
      </button>)}
      <button className="mp-plan-pin" onClick={() => setSheet('plan')}><b>{planTime}</b> · {planName}</button>
      {!headerControls && <button className="mp-me" onClick={openStatus}>
        <img src="/misha-questionnaire-v1.jpg" alt="" />
        <span className="mp-me-label"><Pencil size={13}/> Я сейчас</span>
        <MapStatusLines
          want={variant === 0 || !showCan || !offer ? upperFirst(want) : undefined}
          offer={variant === 0 || showCan || !want ? shortOffer(offer) : undefined}
        />
      </button>}
      {headerControls && <MapQuickControls onDonate={() => setSheet('donate')} onLocate={() => setLocated(true)} locating={false} />}
      {headerControls && located && <span className="absolute bottom-5 left-4 text-cap font-bold">Ты здесь</span>}
      {!headerControls && <div className="mp-map-actions"><button className="mp-icon" aria-label={dense ? 'Показать меньше меток' : 'Показать больше меток'} onClick={() => setDense(!dense)}><Layers size={20}/></button>
      <button className="mp-primary" onClick={() => setSheet('create')}><Plus size={18}/> Найти компанию</button></div>}
    </div>}
    {tab === 'people' && <div className="mp-content"><button className="mp-own-row" onClick={openStatus}><Pencil size={17}/> Я сейчас · {want || offer || 'Добавить статус'}</button>
      {people.map(p => <button className={'mp-person-card mp-pin-'+p.tone} key={p.name} onClick={() => openPerson(p)}><span className="mp-avatar">{p.name[0]}</span><b>{p.name}</b><span>Хочу {p.want}</span><span>Могу {p.offer}</span></button>)}
    </div>}
    {tab === 'events' && <div className="mp-content"><div className="mp-formats"><b>Два способа встретиться</b><span><strong>Найти компанию</strong> · есть простой план, можно позвать людей за минуту.</span><span><strong>Обычная сходка</strong> · нужна подробная карточка, например для экскурсии или игры по записи.</span></div><button className="mp-primary" onClick={() => setSheet('create')}><Plus size={18}/> Найти компанию</button>
      <button className="mp-event-card" onClick={() => setSheet('plan')}><small>Ищу компанию · сегодня в {planTime}</small><b>{planName} · {published ? where : 'Боровляны'}</b><span>{published ? seats : '2'} места · Открыть план <ArrowUpRight size={14}/></span></button>
      <div className="mp-regular"><small>Сходка · суббота</small><b>Большая прогулка по лесу</b><span>11:00 · Боровляны</span></div>
    </div>}
    <nav className="mp-nav" aria-label="Экраны прототипа">
      {([['map','Карта'],['people','Люди'],['events','Сходки']] as const).map(([key,label]) => <button key={key} aria-pressed={key === tab} onClick={() => setTab(key)}>{label}</button>)}
    </nav>
    {sheet === 'status' && <LiveStatusEditor
      status={expiresAt ? { want, offer, expiresAt: new Date(expiresAt).toISOString() } : null}
      onClose={close}
      activityUnread={noticeRead ? 0 : 2}
      onOpenActivity={headerControls ? () => { setNoticeRead(true); setSheet('invites'); } : undefined}
      onSave={async (nextWant, nextOffer, hours) => {
        setWant(hours ? nextWant.trim() : '');
        setOffer(hours ? nextOffer.trim() : '');
        setExpiresAt(hours ? Date.now() + hours * hourMs : 0);
      }}
    />}
    {(sheet === 'person' || sheet === 'profile') && <BottomSheet title={person.name} onClose={close}><div className="mp-form">
      <p><MapPin size={15}/> Боровляны</p><div className="mp-quote"><b>Хочу</b> {person.want}</div><div className="mp-quote"><b>Могу</b> {person.offer}</div>
      {sheet === 'person' ? <><button className="mp-primary" onClick={() => { setPersonal(true); setSheet('create'); }}>Позвать лично</button><button className="mp-secondary" onClick={() => setSheet('profile')}>Открыть анкету <ArrowUpRight size={16}/></button></> : <p>Люблю прогулки, кофе и разговоры обо всём.</p>}
    </div></BottomSheet>}
    {sheet === 'create' && <BottomSheet title="Найти компанию" onClose={close}><form className="mp-form" onSubmit={e => { e.preventDefault(); setPublished(true); setResponse(''); setSheet('plan'); }}>
      <p>Простой план с временем, местом и числом свободных мест. После публикации он появится в «Сходках».</p>
      <label>Что делаем<select value={activity} onChange={e => setActivity(e.target.value)}><option>Прогулка</option><option>Кофе</option><option>Обед</option></select></label>
      <div className="mp-fields"><label>Сегодня в<input type="time" required value={when} onChange={e => setWhen(e.target.value)}/></label><label>Свободных мест<input type="number" min="1" max="8" required value={seats} onChange={e => setSeats(e.target.value)}/></label></div>
      <label>Где<input required value={where} onChange={e => setWhere(e.target.value)}/></label>
      <label className="mp-check"><input type="checkbox" checked={personal} onChange={e => setPersonal(e.target.checked)}/> Позвать лично</label>
      {personal && <label>Кого позвать<select value={person.name} onChange={e => setPerson(people.find(p => p.name === e.target.value) || people[0])}>{people.map(p => <option key={p.name}>{p.name}</option>)}</select></label>}
      <label className="mp-check"><input type="checkbox" checked={nearby} onChange={e => setNearby(e.target.checked)}/> Позвать тех, кто рядом</label>
      <button className="mp-primary" type="submit">Опубликовать план</button>
    </form></BottomSheet>}
    {(sheet === 'plan' || sheet === 'invitePlan') && <BottomSheet title={ownPlan ? planName : 'Кофе'} onClose={close}><div className="mp-form">
      <div className="mp-event-card"><small>Ищу компанию · сегодня в {ownPlan ? planTime : '19:00'}</small><b>{ownPlan ? where : 'Боровляны'}</b><span>{ownPlan ? seats : '2'} свободных места</span></div>
      {ownPlan ? <><p>План появился на карте и в «Сходках».</p>{(personal || nearby) && <p>Приглашения: {personal ? person.name : ''}{personal && nearby ? ', ' : ''}{nearby ? 'люди поблизости' : ''}</p>}</>
      : response ? <p role="status">{response}</p> : <><button className="mp-primary" onClick={() => setResponse('Ты в компании!')}>Я иду</button><button className="mp-secondary" onClick={() => setResponse('Приглашение скрыто')}>Не сегодня</button></>}
    </div></BottomSheet>}
    {sheet === 'donate' && <BottomSheet title="Донат проекту" onClose={close}><p>Так открывается окно поддержки ГУЛЯЙ!.</p></BottomSheet>}
    {sheet === 'invites' && <BottomSheet title="Приглашения" onClose={close}><button className="mp-event-card" onClick={() => setSheet('invitePlan')}><small>Личное приглашение</small><b>Лена зовёт на кофе</b><span>Сегодня в 19:00 · Боровляны</span></button><div className="mp-regular mt-2"><small>Предложение поблизости</small><b>Рядом ищут компанию на прогулку</b><span>Сегодня в 20:00 · Боровляны</span></div></BottomSheet>}
  </main>;
}
