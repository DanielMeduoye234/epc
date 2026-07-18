// Lightweight stale-while-revalidate cache for client-side Supabase queries.
//
// Pages call `getCached(key)` on mount: if a snapshot exists the page renders
// it instantly (no spinner), then refetches in the background and calls
// `setCached(key, fresh)` so the next visit is instant too. Data is therefore
// never served stale without a refresh being underway.
//
// Snapshots live in an in-memory Map (survives client-side navigation) and
// sessionStorage (survives a full page reload within the same tab).

interface CacheEntry<T> {
  data: T;
  time: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

// Entries older than this are ignored even as a "instant paint" snapshot.
const MAX_SNAPSHOT_AGE_MS = 30 * 60 * 1000;

const storageKey = (key: string) => `epc-cache:${key}`;

export function getCached<T>(key: string): T | null {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.time < MAX_SNAPSHOT_AGE_MS) return hit.data as T;

  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - parsed.time >= MAX_SNAPSHOT_AGE_MS) {
      sessionStorage.removeItem(storageKey(key));
      return null;
    }
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, time: Date.now() };
  memory.set(key, entry);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Quota exceeded or unavailable — memory cache still works.
  }
}

export function invalidateCached(prefix: string): void {
  for (const key of Array.from(memory.keys())) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  if (typeof window === 'undefined') return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(storageKey(prefix))) sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access issues.
  }
}
