export interface StoreEntry {
  text: string;
  fetchedAt: number;
}

export interface Store {
  get(key: string): Promise<StoreEntry | undefined>;
  put(key: string, entry: StoreEntry): Promise<void>;
}

export class MemoryStore implements Store {
  private entries = new Map<string, StoreEntry>();
  async get(key: string) {
    return this.entries.get(key);
  }
  async put(key: string, entry: StoreEntry) {
    this.entries.set(key, entry);
  }
}

// Persists across worker suspensions and browser restarts; the Cache API is available to extension service
// workers, event pages, and extension pages alike.
export class CacheApiStore implements Store {
  private cacheName: string;
  constructor(cacheName = 'web-specs-companion-v1') {
    this.cacheName = cacheName;
  }
  private keyUrl(key: string) {
    return `https://web-specs-companion.invalid/${encodeURIComponent(key)}`;
  }
  async get(key: string) {
    const cache = await caches.open(this.cacheName);
    const res = await cache.match(this.keyUrl(key));
    if (!res) return undefined;
    return { text: await res.text(), fetchedAt: Number(res.headers.get('x-fetched-at') ?? 0) };
  }
  async put(key: string, entry: StoreEntry) {
    const cache = await caches.open(this.cacheName);
    await cache.put(
      this.keyUrl(key),
      new Response(entry.text, { headers: { 'content-type': 'text/plain', 'x-fetched-at': String(entry.fetchedAt) } }),
    );
  }
}

export interface FetchOptions {
  ttlMs: number;
  init?: RequestInit;
  key?: string;
  timeoutMs?: number;
}

export interface Http {
  text(url: string, opts: FetchOptions): Promise<string | undefined>;
  json<T>(url: string, opts: FetchOptions): Promise<T | undefined>;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
  }
}

const NOT_FOUND = '\u0000not-found';
const DEFAULT_TIMEOUT = 15_000;
// After a failed fetch (network error, timeout, 429, 5xx), don't hit the same URL again for this long.
const FAILURE_BACKOFF = 60_000;

export function createHttp(
  store: Store,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  now: () => number = Date.now,
): Http {
  const inflight = new Map<string, Promise<string | undefined>>();
  const failedAt = new Map<string, number>();
  const unwrap = (text: string) => (text === NOT_FOUND ? undefined : text);
  // A failing store (quota, no Cache API) degrades to fetching every time, rather than failing the request.
  const safeGet = (key: string) => store.get(key).catch(() => undefined);
  const safePut = (key: string, entry: StoreEntry) => store.put(key, entry).catch(() => {});

  async function load(url: string, opts: FetchOptions, key: string): Promise<string | undefined> {
    const cached = await safeGet(key);
    if (cached && now() - cached.fetchedAt < opts.ttlMs) return unwrap(cached.text);
    const lastFailure = failedAt.get(key);
    if (lastFailure !== undefined && now() - lastFailure < FAILURE_BACKOFF) {
      if (cached) return unwrap(cached.text);
      throw new Error(`not retrying ${url} yet: it failed moments ago`);
    }
    try {
      const signal = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT);
      const res = await fetchImpl(url, { ...opts.init, signal });
      if (res.status === 404 || res.status === 410) {
        failedAt.delete(key);
        await safePut(key, { text: NOT_FOUND, fetchedAt: now() });
        return undefined;
      }
      if (!res.ok) throw new HttpError(res.status, url);
      const body = await res.text();
      failedAt.delete(key);
      await safePut(key, { text: body, fetchedAt: now() });
      return body;
    } catch (err) {
      failedAt.set(key, now());
      if (cached) return unwrap(cached.text);
      throw err;
    }
  }

  async function text(url: string, opts: FetchOptions) {
    const key = opts.key ?? url;
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = load(url, opts, key).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  return {
    text,
    async json<T>(url: string, opts: FetchOptions) {
      const t = await text(url, opts);
      return t === undefined ? undefined : (JSON.parse(t) as T);
    },
  };
}
