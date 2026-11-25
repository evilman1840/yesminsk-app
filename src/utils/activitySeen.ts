// Only local read markers; no IDs, names or notification text go to analytics.
export function readActivitySeen(userId: number): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(`gulyai_activity_seen_${userId}`) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : []);
  } catch { return new Set(); }
}

export function markActivitySeen(userId: number, previous: Set<string>, keys: string[]): Set<string> {
  // Keep every currently shown item, plus a small recent history for items that disappear.
  const seen = new Set([...Array.from(previous).slice(-500), ...keys]);
  if (userId) try { localStorage.setItem(`gulyai_activity_seen_${userId}`, JSON.stringify([...seen])); } catch { /* Reading remains available in private mode. */ }
  return seen;
}
