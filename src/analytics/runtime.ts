import { ActivityTracker, AnalyticsSender } from './core';
import { AnalyticsElement, AnalyticsProperties, AnalyticsScreen, ClientEventName, ELEMENTS } from './contract';
let sender: AnalyticsSender = async () => {};
const tracker = new ActivityTracker((events,keepalive)=>sender(events,keepalive));
const ready = new Set<()=>void>();
let scan: ()=>void = ()=>{};
let installed=false;
export const analyticsSessionScreen = (screen: AnalyticsScreen) => { tracker.setScreen(screen); scan(); };
export const track = (event: ClientEventName, properties: AnalyticsProperties = {}) => tracker.record(event,properties);
export const trackClick = (element: AnalyticsElement) => tracker.click(element);
export const trackImpression = (element: AnalyticsElement) => tracker.impression(element);
export const whenAnalyticsEnabled = (cb:()=>void) => { ready.add(cb); if(tracker.enabled)cb(); return ()=>{ready.delete(cb);}; };
export function configureAnalytics(enabled: boolean, transport?: AnalyticsSender): void {
  if(transport) sender=transport;
  const before=tracker.enabled;
  tracker.setVisible(document.visibilityState==='visible');
  tracker.configure(enabled && import.meta.env.PROD);
  if(tracker.enabled&&!installed) install();
  if(tracker.enabled&&!before){for(const cb of ready)cb();scan();}
}
function install(): void {
 installed=true;
 const visible=()=>{tracker.setVisible(document.visibilityState==='visible');if(document.visibilityState==='hidden')void tracker.flush(true);else {for(const cb of ready)cb();scan();}};
 document.addEventListener('visibilitychange',visible);
 window.addEventListener('pagehide',()=>{tracker.setVisible(false);void tracker.flush(true);});
 window.addEventListener('pageshow',visible);
 for(const name of ['pointerdown','keydown','scroll'] as const)document.addEventListener(name,()=>tracker.interaction(),{passive:true,capture:true});
 document.addEventListener('click',event=>{
   const button=(event.target as Element)?.closest?.('[data-analytics]') as HTMLElement | null;
   const element=button?.dataset.analytics as AnalyticsElement;
   if(button && !(button as HTMLButtonElement).disabled && ELEMENTS.includes(element))tracker.click(element);
 },{capture:true});
 const visibleElement=(el:HTMLElement)=>{
   if(!tracker.enabled||document.visibilityState!=='visible'||(el as HTMLButtonElement).disabled)return;
   const rect=el.getBoundingClientRect();if(rect.width<1||rect.height<1||rect.top<0||rect.bottom>innerHeight)return;
   const top=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
   if(top&&el.contains(top))tracker.impression(el.dataset.analytics as AnalyticsElement);
 };
 const observer=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting&&item.intersectionRatio>=.5)visibleElement(item.target as HTMLElement);},{threshold:.5});
 const observed=new WeakSet<HTMLElement>();
 scan=()=>{document.querySelectorAll<HTMLElement>('[data-analytics]').forEach(el=>{if(!observed.has(el)){observed.add(el);observer.observe(el);}visibleElement(el);});};
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','data-analytics']});
 window.setInterval(()=>tracker.tick(),1000);
 window.setInterval(()=>{void tracker.flush();},20000);
 visible();scan();
}
