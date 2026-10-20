// The handlers' dependencies, faked for tests: session storage in memory, the bundled catalog as every source, and an
// HTTP client that finds nothing.
import { vi } from 'vitest';
import type { HandlerDeps } from '../../src/background/handlers.ts';
import { ReviewStore } from '../../src/background/reviews.ts';
import { TabStore, type SessionArea } from '../../src/background/tabs.ts';
import { createHttp, MemoryStore } from '../../src/data/http.ts';
import type { Sources } from '../../src/data/sources.ts';
import { specs, groups, repos } from './catalog.ts';

export function fakeSession(): SessionArea {
  const m = new Map<string, unknown>();
  return {
    async get(key) { return m.has(key) ? { [key]: m.get(key) } : {}; },
    async set(items) { for (const [k, v] of Object.entries(items)) m.set(k, v); },
    async remove(key) { m.delete(key); },
  };
}

export function fakeSources(extra: Record<string, unknown> = {}): Sources {
  const data: Record<string, unknown> = { specs, groups, repos, idlnames: {}, ...extra };
  return { load: async (name: string) => ({ data: data[name], fetchedAt: 1, origin: 'bundled' }) } as unknown as Sources;
}

export function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    sources: fakeSources(),
    http: createHttp(new MemoryStore(), vi.fn(async () => new Response('', { status: 404 })), () => 0),
    tabs: new TabStore(fakeSession()),
    now: () => Date.UTC(2026, 9, 16),
    setBadge: vi.fn(),
    reviews: new ReviewStore(fakeSession(), () => Date.UTC(2026, 9, 21)),
    ...over,
  };
}
