import type { Loaded } from '../shared/types.ts';
import type { Store } from './http.ts';
import { slimCaniuse, slimGroups, slimIdlNames, slimImplementations, slimMdn, slimRepos, slimSpecs, slimWpt } from './slim.ts';
import { parseIcs } from './tpac.ts';
import { DAY, MINUTE, URLS } from './urls.ts';

const LIVE_TIMEOUT = 8_000;
// After a live fetch fails, serve the stored or bundled copy for this long before trying the network again.
const RETRY_AFTER = 2 * MINUTE;

interface SourceDef<T> {
  url: string;
  bundled: string;
  ttlMs: number;
  slim: (text: string) => T;
}

const def = <T>(d: SourceDef<T>) => d;

export const SOURCES = {
  specs: def({ url: URLS.specs, bundled: 'data/specs.json', ttlMs: DAY, slim: (t) => slimSpecs(JSON.parse(t)) }),
  groups: def({ url: URLS.groups, bundled: 'data/groups.json', ttlMs: DAY, slim: (t) => slimGroups(JSON.parse(t)) }),
  repos: def({ url: URLS.repos, bundled: 'data/repos.json', ttlMs: DAY, slim: (t) => slimRepos(JSON.parse(t)) }),
  idlnames: def({ url: URLS.idlnames, bundled: 'data/idlnames.json', ttlMs: DAY, slim: (t) => slimIdlNames(JSON.parse(t)) }),
  implementations: def({ url: URLS.implementations, bundled: 'data/implementations.json', ttlMs: DAY, slim: (t) => slimImplementations(JSON.parse(t)) }),
  mdn: def({ url: URLS.mdn, bundled: 'data/mdn.json', ttlMs: DAY, slim: (t) => slimMdn(JSON.parse(t)) }),
  caniuse: def({ url: URLS.caniuse, bundled: 'data/caniuse.json', ttlMs: DAY, slim: (t) => slimCaniuse(JSON.parse(t)) }),
  wpt: def({ url: URLS.wpt, bundled: 'data/wpt.json', ttlMs: DAY, slim: (t) => slimWpt(JSON.parse(t)) }),
  tpac: def({ url: URLS.tpac, bundled: 'data/tpac2026.json', ttlMs: 15 * MINUTE, slim: (t) => parseIcs(t) }),
};

export type SourceName = keyof typeof SOURCES;
export type SourceData<K extends SourceName> = ReturnType<(typeof SOURCES)[K]['slim']>;

export interface SourceDeps {
  store: Store;
  fetchImpl: typeof fetch;
  now: () => number;
  readBundled: (path: string) => Promise<string>;
  bundledAt: () => Promise<number>;
}

export interface Sources {
  load<K extends SourceName>(name: K, opts?: { force?: boolean }): Promise<Loaded<SourceData<K>>>;
}

export function createSources(deps: SourceDeps): Sources {
  const memory = new Map<SourceName, Loaded<unknown>>();
  const inflight = new Map<SourceName, Promise<Loaded<unknown>>>();
  const lastFailure = new Map<SourceName, number>();

  async function loadOnce(name: SourceName, force: boolean): Promise<Loaded<unknown>> {
    const src = SOURCES[name];
    const now = deps.now();
    const mem = memory.get(name);
    if (!force && mem && now - mem.fetchedAt < src.ttlMs && mem.origin !== 'bundled') return mem;

    const key = `slim:${name}`;
    const stored = await deps.store.get(key).catch(() => undefined);
    if (!force && stored && now - stored.fetchedAt < src.ttlMs) {
      const hit = { data: JSON.parse(stored.text), fetchedAt: stored.fetchedAt, origin: 'cache' as const };
      memory.set(name, hit);
      return hit;
    }
    try {
      const failedAt = lastFailure.get(name);
      if (!force && failedAt !== undefined && now - failedAt < RETRY_AFTER) throw new Error(`${name}: live fetch failed moments ago`);
      const res = await deps.fetchImpl(src.url, { signal: AbortSignal.timeout(LIVE_TIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${src.url}`);
      const data = src.slim(await res.text());
      lastFailure.delete(name);
      await deps.store.put(key, { text: JSON.stringify(data), fetchedAt: now }).catch(() => {});
      const live = { data, fetchedAt: now, origin: 'live' as const };
      memory.set(name, live);
      return live;
    } catch (err) {
      if (!lastFailure.has(name) || now - lastFailure.get(name)! >= RETRY_AFTER) lastFailure.set(name, now);
      if (stored) {
        const stale = { data: JSON.parse(stored.text), fetchedAt: stored.fetchedAt, origin: 'stale' as const };
        memory.set(name, stale);
        return stale;
      }
      if (mem) return mem;
      const bundled = {
        data: JSON.parse(await deps.readBundled(src.bundled)),
        fetchedAt: await deps.bundledAt(),
        origin: 'bundled' as const,
      };
      memory.set(name, bundled);
      console.warn(`w3c-companion: using bundled ${name}:`, err);
      return bundled;
    }
  }

  return {
    load<K extends SourceName>(name: K, opts: { force?: boolean } = {}) {
      const pending = inflight.get(name);
      if (pending && !opts.force) return pending as Promise<Loaded<SourceData<K>>>;
      const p = loadOnce(name, !!opts.force).finally(() => inflight.delete(name));
      inflight.set(name, p);
      return p as Promise<Loaded<SourceData<K>>>;
    },
  };
}
