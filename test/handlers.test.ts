import { describe, it, expect, vi } from 'vitest';
import { createHandlers, type HandlerDeps } from '../src/background/handlers.ts';
import { TabStore, type SessionArea } from '../src/background/tabs.ts';
import { createHttp, MemoryStore } from '../src/data/http.ts';
import type { Sources } from '../src/data/sources.ts';
import { specs, groups, repos } from './fixtures/catalog.ts';
import { parseIcs } from '../src/data/tpac.ts';
import { readFileSync } from 'node:fs';

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

  it('answers get-group-details with null when the API is unreachable', async () => {
    const http = createHttp(new MemoryStore(), vi.fn(async () => { throw new TypeError('offline'); }), () => 0);
    const r = await createHandlers(deps({ http })).handle({ type: 'get-group-details', identifier: 'wg/css' }, sender(1));
    expect(r).toEqual({ details: null });
  });

  it("answers get-tpac with the group's slots", async () => {
    const tpac = parseIcs(readFileSync(new URL('./fixtures/tpac.ics', import.meta.url), 'utf8'));
    const h = createHandlers(deps({ sources: fakeSources({ tpac }), now: () => Date.parse('2026-10-26T10:00:00Z') }));
    const r = (await h.handle({ type: 'get-tpac', groupNames: ['Web Application Security Working Group'] }, sender(1))) as {
      visible: boolean; now: { uid: string }[]; slots: Record<string, { room?: string }[]>;
    };
    expect(r.visible).toBe(true);
    expect(r.now.map((e) => e.uid)).toContain('group-1');
    expect(r.slots['Web Application Security Working Group'][0].room).toBe('Ground Floor - Munster Suite');
  });

  it('searches the indexes, and falls back to webidlpedia when the xref service is down', async () => {
    const http = createHttp(new MemoryStore(), vi.fn(async () => { throw new TypeError('offline'); }), () => 0);
    const h = createHandlers(deps({ http, sources: fakeSources({ idlnames: { Request: { type: 'interface' } } }) }));
    const r = (await h.handle({ type: 'search', query: 'fetch' }, sender(1))) as { items: { url: string }[] };
    expect(r.items[0].url).toBe('https://fetch.spec.whatwg.org/');
    const t = (await h.handle({ type: 'search', query: 'dfn navigate' }, sender(1))) as { items: unknown[] };
    expect(t.items).toEqual([]);
    const idl = (await h.handle({ type: 'resolve-idl', name: 'Request' }, sender(1))) as { url: string };
    expect(idl.url).toBe('https://dontcallmedom.github.io/webidlpedia/names/Request.html');
  });

  it('answers get-used-by and get-footprint with null when webref is unreachable', async () => {
    const http = createHttp(new MemoryStore(), vi.fn(async () => { throw new TypeError('offline'); }), () => 0);
    const h = createHandlers(deps({ http }));
    expect(await h.handle({ type: 'get-used-by', shortname: 'fetch' }, sender(1))).toEqual({ map: null, specdex: 'https://dontcallmedom.github.io/specdex/fetch.html' });
    expect(await h.handle({ type: 'get-footprint', shortname: 'fetch' }, sender(1))).toEqual({ footprint: null });
  });

  it('builds the used-by map and the footprint from webref', async () => {
    const files: Record<string, unknown> = {
      'https://w3c.github.io/webref/ed/index.json': { date: '9 October 2026', results: [{ shortname: 'fetch', date: '9 October 2026', backrefs: 'backrefs/fetch.json', refs: 'refs/fetch.json' }] },
      'https://w3c.github.io/webref/ed/backrefs/fetch.json': { backrefs: [{ id: 'concept-fetch', href: 'https://fetch.spec.whatwg.org/#concept-fetch', linkingText: ['fetch'], type: 'dfn', for: [], access: 'public', referencedBy: [{ shortname: 'html', title: 'HTML Standard', url: 'https://html.spec.whatwg.org/multipage/' }] }] },
      'https://w3c.github.io/webref/ed/refs/fetch.json': { refs: { normative: [{ name: 'HTML', url: 'https://html.spec.whatwg.org/multipage/' }], informative: [] } },
    };
    const http = createHttp(new MemoryStore(), vi.fn(async (u: RequestInfo | URL) => (String(u) in files ? new Response(JSON.stringify(files[String(u)])) : new Response('', { status: 404 }))), () => 0);
    const h = createHandlers(deps({ http }));
    const u = (await h.handle({ type: 'get-used-by', shortname: 'fetch' }, sender(1))) as { map: Record<string, { count: number; webdex?: string }> };
    expect(u.map['concept-fetch'].count).toBe(1);
    expect(u.map['concept-fetch'].webdex).toBe('https://dontcallmedom.github.io/webdex/f.html#fetch%40%40fetch%25%25dfn');
    const f = (await h.handle({ type: 'get-footprint', shortname: 'fetch' }, sender(1))) as { footprint: { referencedBy: { shortname: string }[]; normativeRefs: unknown[]; crawlDate: string } };
    expect(f.footprint.referencedBy.map((s) => s.shortname)).toEqual(['html']);
    expect(f.footprint.normativeRefs).toHaveLength(1);
    expect(f.footprint.crawlDate).toBe('9 October 2026');
  });
});
