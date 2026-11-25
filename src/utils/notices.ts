export interface NoticeState { hidden: Record<string, number>; snoozedUntil: number; }
const HIDDEN = 'yesminsk_notice_hidden';
const SNOOZED = 'yesminsk_notice_snoozed_until';
let memory: NoticeState = { hidden: {}, snoozedUntil: 0 };

export function nextMinskDay(now = Date.now()): number {
  const offset = 3 * 3600000;
  return (Math.floor((now + offset) / 86400000) + 1) * 86400000 - offset;
}

export function readNoticeState(now = Date.now()): NoticeState {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN) || '{}');
    const hidden = Object.fromEntries(Object.entries(raw || {}).filter(([, until]) => typeof until === 'number' && until > now));
    memory = { hidden: hidden as Record<string, number>, snoozedUntil: Number(localStorage.getItem(SNOOZED)) || 0 };
  } catch { /* Private mode: retain dismissals for the current app session. */ }
  return memory;
}

export function dismissNotice(id: string, days: number, now = Date.now()): NoticeState {
  const current = readNoticeState(now);
  memory = { hidden: { ...current.hidden, [id]: now + days * 86400000 }, snoozedUntil: nextMinskDay(now) };
  try {
    localStorage.setItem(HIDDEN, JSON.stringify(memory.hidden));
    localStorage.setItem(SNOOZED, String(memory.snoozedUntil));
  } catch { /* No storage is required to use or close a notice. */ }
  return memory;
}

export function pickNotice<T extends { id: string }>(notices: T[], state: NoticeState, now = Date.now()): T | undefined {
  if (state.snoozedUntil > now) return undefined;
  return notices.find(n => !(state.hidden[n.id] > now));
}
