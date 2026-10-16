import { describe, it, expect, vi } from 'vitest';
import { createHandlers, type HandlerDeps } from '../src/background/handlers.ts';
import { TabStore, type SessionArea } from '../src/background/tabs.ts';
import { createHttp, MemoryStore } from '../src/data/http.ts';
import type { Sources } from '../src/data/sources.ts';
import { specs, groups, repos } from './fixtures/catalog.ts';

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
    ...over,
  };
}

const sender = (id: number) => ({ tab: { id } }) as chrome.runtime.MessageSender;

describe('handlers', () => {
  it('stores page facts, sets the badge, and tells the content script its spec', async () => {
    const d = deps();
    const h = createHandlers(d);
    const url = 'https://w3c.github.io/webappsec-fetch-metadata/';
    const reply = await h.handle({ type: 'page-facts', facts: { kind: 'spec', url, status: 'ED' } }, sender(7));
    expect(reply).toEqual({ shortname: 'fetch-metadata' });
    expect(d.setBadge).toHaveBeenCalledWith(7, expect.objectContaining({ kind: 'spec' }));
  });

  it('answers get-context after the worker restarts, from session storage', async () => {
    const tabs = new TabStore(fakeSession());
    const url = 'https://github.com/W3C/ARIA';
    await createHandlers(deps({ tabs })).handle({ type: 'page-facts', facts: { kind: 'github', url, github: { nwo: 'w3c/aria' } } }, sender(3));
    const restarted = createHandlers(deps({ tabs }));
    const { context } = (await restarted.handle({ type: 'get-context', tabId: 3 }, {} as chrome.runtime.MessageSender)) as { context: { repo: { nwo: string } } };
    expect(context.repo.nwo).toBe('w3c/aria');
  });

  it('drops stale facts when the tab moves to another URL', async () => {
    const tabs = new TabStore(fakeSession());
    const h = createHandlers(deps({ tabs }));
    await h.handle({ type: 'page-facts', facts: { kind: 'spec', url: 'https://example.org/a/', title: 'A' } }, sender(4));
    await h.onTabUrl(4, 'https://example.org/b/');
    expect((await tabs.get(4))?.facts).toBeUndefined();
  });

  it('uses the URL the popup passes when the tab has no stored state', async () => {
    const h = createHandlers(deps());
    const r = (await h.handle({ type: 'get-context', tabId: 99, url: 'https://www.w3.org/groups/wg/css/' }, {} as chrome.runtime.MessageSender)) as { context: { kind: string } };
    expect(r.context.kind).toBe('group');
  });

  it('rejects unknown messages', async () => {
    await expect(createHandlers(deps()).handle({ type: 'nope' }, sender(1))).rejects.toThrow(/unknown message/);
  });
});
