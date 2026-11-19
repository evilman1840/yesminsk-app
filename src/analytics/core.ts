import { AnalyticsElement, AnalyticsProperties, AnalyticsScreen, ClientAnalyticsEvent, ClientEventName, ELEMENTS, SCREENS } from './contract';
export type AnalyticsSender = (events: ClientAnalyticsEvent[], keepalive: boolean) => Promise<unknown>;
const randomId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
/** Counts only foreground time within 60 seconds of interaction. Injectable clock/transport for tests. */
export class ActivityTracker {
  enabled = false;
  private visible = true;
  private viewRecorded = false;
  private screen: AnalyticsScreen = 'map';
  private session: string;
  private sessionLastAction = 0;
  private view = 0;
  private lastTick = 0;
  private lastAction = 0;
  private active = 0;
  private queue: ClientAnalyticsEvent[] = [];
  private seen = new Set<string>();
  private sending = false;
  private failures = 0;
  constructor(private send: AnalyticsSender, private now: () => number = Date.now, private uuid: () => string = randomId) { this.session = uuid(); }
  configure(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled; this.queue = []; this.active = 0; this.failures = 0;
    this.lastTick = this.lastAction = this.sessionLastAction = this.now();
    if (enabled) { this.view++; this.seen.clear(); this.viewRecorded=false; this.recordView(); }
  }
  setScreen(screen: AnalyticsScreen): void {
    if (!SCREENS.includes(screen) || this.screen === screen) return;
    this.tick(); this.commitTime(); this.screen = screen; this.view++; this.seen.clear(); this.viewRecorded=false;
    this.lastTick = this.lastAction = this.now();
    if (this.enabled) this.recordView();
  }
  interaction(): void {
    const now = this.now(); this.tick();
    if (now-this.sessionLastAction > 30*60*1000) { this.commitTime(); this.session = this.uuid(); this.view++; this.seen.clear(); this.viewRecorded=false; if (this.enabled) this.recordView(); }
    this.lastAction = this.sessionLastAction = now;
  }
  setVisible(visible: boolean): void {
    this.tick(); if (!visible) this.commitTime();
    this.visible = visible; this.lastTick = this.now();
    if (visible) { this.interaction(); this.recordView(); }
  }
  private recordView(): void { if(this.enabled && this.visible && !this.viewRecorded){this.viewRecorded=true;this.record('gulyai_screen_viewed');} }
  tick(): void {
    const now = this.now();
    if (this.enabled && this.visible) this.active += Math.max(0,Math.min(now,this.lastAction+60000)-this.lastTick);
    this.lastTick = now;
  }
  private commitTime(): void {
    if (this.active >= 1000) this.record('gulyai_screen_active',{active_ms:Math.min(120000,Math.floor(this.active))});
    this.active = 0;
  }
  record(event: ClientEventName, properties: AnalyticsProperties = {}): boolean {
    if (!this.enabled || !this.visible || this.queue.length >= 200) return false;
    this.queue.push({ id:this.uuid(),event,session_id:this.session,at:this.now(),properties:{screen:this.screen,...properties} });
    return true;
  }
  impression(element: AnalyticsElement): void {
    if (!this.enabled || !this.visible || !ELEMENTS.includes(element)) return;
    const key=this.view+':'+element; if(this.seen.has(key))return; this.seen.add(key);
    this.record('gulyai_element_seen',{element});
  }
  click(element: AnalyticsElement): void {
    if (!ELEMENTS.includes(element)) return;
    this.interaction(); this.impression(element); this.record('gulyai_element_clicked',{element});
  }
  async flush(keepalive=false): Promise<void> {
    this.tick(); this.commitTime();
    if (!this.enabled || this.sending || !this.queue.length) return;
    this.sending=true; const batch=this.queue.splice(0,40);
    try { await this.send(batch,keepalive); this.failures=0; }
    catch { if(this.enabled && ++this.failures<=3) this.queue=[...batch,...this.queue].slice(0,200); }
    finally { this.sending=false; }
  }
}
