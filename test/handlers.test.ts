import { describe, it, expect, vi } from 'vitest';
import { createHandlers, type HandlerDeps } from '../src/background/handlers.ts';
import { TabStore, type SessionArea } from '../src/background/tabs.ts';
import { createHttp, MemoryStore } from '../src/data/http.ts';
import type { Sources } from '../src/data/sources.ts';
import { specs, groups, repos } from './fixtures/catalog.ts';
import { parseIcs } from '../src/data/tpac.ts';
import { readFileSync } from 'node:fs';
import { deps, fakeSession, fakeSources } from './fixtures/background.ts';

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

  it('checks links against the target spec ids from webref', async () => {
    const files: Record<string, unknown> = {
      'https://w3c.github.io/webref/ed/index.json': { date: '9 October 2026', results: [{ shortname: 'fetch-metadata', ids: 'ids/fetch-metadata.json', dfns: 'dfns/fetch-metadata.json' }] },
      'https://w3c.github.io/webref/ed/ids/fetch-metadata.json': { ids: ['https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-dest-header'] },
      'https://w3c.github.io/webref/ed/dfns/fetch-metadata.json': { dfns: [] },
    };
    const http = createHttp(new MemoryStore(), vi.fn(async (u: RequestInfo | URL) => (String(u) in files ? new Response(JSON.stringify(files[String(u)])) : new Response('', { status: 404 }))), () => 0);
    const r = (await createHandlers(deps({ http, now: () => Date.UTC(2026, 9, 17) })).handle({
      type: 'check-links',
      shortname: 'fetch',
      links: [
        { i: 0, href: 'https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-dest-header', text: 'Sec-Fetch-Dest' },
        { i: 1, href: 'https://w3c.github.io/webappsec-fetch-metadata/#gone', text: 'gone' },
      ],
    }, sender(1))) as { problems: { i: number }[]; checked: number; crawlDate: string };
    expect(r.problems.map((p) => p.i)).toEqual([1]);
    expect(r.checked).toBe(2);
    expect(r.crawlDate).toBe('9 October 2026');
  });

  it('compares the latest TR with the date webref crawled for its draft', async () => {
    const files: Record<string, unknown> = {
      'https://api.w3.org/specifications/fetch-metadata': { _links: { 'latest-version': { href: 'https://api.w3.org/specifications/fetch-metadata/versions/20250815' } } },
      'https://api.w3.org/specifications/fetch-metadata/versions/20250815': { status: 'Working Draft', date: '2025-08-15', uri: 'https://www.w3.org/TR/2025/WD-fetch-metadata-20250815/' },
      'https://w3c.github.io/webref/ed/index.json': { date: '19 October 2026', results: [{ shortname: 'fetch-metadata', date: '01 October 2026' }] },
    };
    const http = createHttp(new MemoryStore(), vi.fn(async (u: RequestInfo | URL) => (String(u) in files ? new Response(JSON.stringify(files[String(u)])) : new Response('', { status: 404 }))), () => 0);
    const h = createHandlers(deps({ http, now: () => Date.UTC(2026, 9, 18) }));
    const r = (await h.handle({ type: 'get-radar', tabId: 1, url: 'https://www.w3.org/TR/fetch-metadata/' }, sender(1))) as { radar: { notes: unknown[] } };
    expect(r.radar.notes).toContainEqual({ kind: 'behind-ed', months: 13, edDate: '2026-10-01', edUrl: 'https://w3c.github.io/webappsec-fetch-metadata/' });
  });

  it('reports how fresh each source is', async () => {
    const r = (await createHandlers(deps({ sources: fakeSources({ tpac: [] }), now: () => Date.parse('2026-10-27T10:00:00Z') })).handle({ type: 'get-freshness' }, sender(1))) as { sources: { name: string; origin: string }[] };
    expect(r.sources.map((s) => s.name)).toEqual(['specs', 'groups', 'repos', 'implementations', 'mdn', 'caniuse', 'wpt', 'tpac']);
    expect(r.sources.every((s) => s.origin === 'bundled')).toBe(true);
  });

  it('tells open panels when page facts change a tab\'s context', async () => {
    const notify = vi.fn();
    await createHandlers(deps({ notify })).handle({ type: 'page-facts', facts: { kind: 'spec', url: 'https://w3c.github.io/webappsec-fetch-metadata/' } }, sender(7));
    expect(notify).toHaveBeenCalledWith(7);
  });

  it('leaves the TPAC calendar alone outside the TPAC window', async () => {
    const load = vi.fn(async (name: string) => ({ data: ({ specs, groups, repos } as Record<string, unknown>)[name] ?? [], fetchedAt: 1, origin: 'live' }));
    const h = createHandlers(deps({ sources: { load } as unknown as Sources, now: () => Date.parse('2026-11-05T10:00:00Z') }));
    expect(await h.handle({ type: 'get-tpac', groupNames: ['x'] }, sender(1))).toMatchObject({ visible: false, now: [], next: [] });
    const f = (await h.handle({ type: 'get-freshness' }, sender(1))) as { sources: { name: string }[] };
    expect(f.sources.map((s) => s.name)).toEqual(['specs', 'groups', 'repos', 'implementations', 'mdn', 'caniuse', 'wpt']);
    expect(load).not.toHaveBeenCalledWith('tpac');
  });

  it("answers get-implementations with the spec's record, its series' current level's, or null", async () => {
    const bcd = { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' };
    const rec = { engines: ['gecko', 'webkit', 'blink'], basis: 'shared', core: 2, ships: { gecko: 2, webkit: 2, blink: 2 }, lacks: {} };
    const implementations = { bcd, specs: { 'fetch-metadata': rec, 'wai-aria-1.2': { ...rec, core: 5 } } };
    const h = createHandlers(deps({ sources: fakeSources({ implementations }) }));
    expect(await h.handle({ type: 'get-implementations', shortname: 'fetch-metadata' }, sender(1))).toEqual({ impl: { ...rec, bcd } });
    expect(await h.handle({ type: 'get-implementations', shortname: 'wai-aria-1.3' }, sender(1))).toEqual({
      impl: { ...rec, core: 5, bcd, fromSeries: { shortname: 'wai-aria-1.2', title: 'WAI-ARIA 1.2' } },
    });
    expect(await h.handle({ type: 'get-implementations', shortname: 'css-grid-3' }, sender(1))).toEqual({ impl: null });
    expect(await h.handle({ type: 'get-implementations', shortname: 'constructor' }, sender(1))).toEqual({ impl: null });
  });

  it('answers get-implementations with null when the browser-support file fails to load', async () => {
    const load = vi.fn(async (name: string) => {
      if (name === 'implementations') throw new Error('offline');
      return { data: ({ specs, groups, repos } as Record<string, unknown>)[name], fetchedAt: 1, origin: 'bundled' };
    });
    const h = createHandlers(deps({ sources: { load } as unknown as Sources }));
    expect(await h.handle({ type: 'get-implementations', shortname: 'fetch-metadata' }, sender(1))).toEqual({ impl: null });
  });

  it('answers get-implementations with null for a record shaped by another build', async () => {
    const bcd = { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' };
    const h = createHandlers(deps({ sources: fakeSources({ implementations: { bcd, specs: { 'fetch-metadata': { implemented: ['gecko'] } } } }) }));
    expect(await h.handle({ type: 'get-implementations', shortname: 'fetch-metadata' }, sender(1))).toEqual({ impl: null });
  });

  it("answers get-mdn with the spec's view, its series' current level's, or null", async () => {
    const content = { commit: 'a'.repeat(40), date: '2026-10-18' };
    const mdn = { content, types: ['web-api-interface'], pages: [['Web/API/A', 'A', 0], ['Web/API/B', 'B', 0]], specs: { 'fetch-metadata': [0], 'wai-aria-1.2': [1] } };
    const h = createHandlers(deps({ sources: fakeSources({ mdn }) }));
    const item = (title: string) => ({ title, url: `https://developer.mozilla.org/docs/Web/API/${title}`, children: [], count: 0 });
    expect(await h.handle({ type: 'get-mdn', shortname: 'fetch-metadata' }, sender(1))).toEqual({
      mdn: { count: 1, overviews: [], sections: [{ name: 'Interfaces', items: [item('A')] }], content },
    });
    expect(await h.handle({ type: 'get-mdn', shortname: 'wai-aria-1.3' }, sender(1))).toEqual({
      mdn: { count: 1, overviews: [], sections: [{ name: 'Interfaces', items: [item('B')] }], content, fromSeries: { shortname: 'wai-aria-1.2', title: 'WAI-ARIA 1.2' } },
    });
    expect(await h.handle({ type: 'get-mdn', shortname: 'css-grid-3' }, sender(1))).toEqual({ mdn: null });
    expect(await h.handle({ type: 'get-mdn', shortname: 'constructor' }, sender(1))).toEqual({ mdn: null });
  });

  it('answers get-mdn with null when the MDN file fails to load', async () => {
    const load = vi.fn(async (name: string) => {
      if (name === 'mdn') throw new Error('offline');
      return { data: ({ specs, groups, repos } as Record<string, unknown>)[name], fetchedAt: 1, origin: 'bundled' };
    });
    const h = createHandlers(deps({ sources: { load } as unknown as Sources }));
    expect(await h.handle({ type: 'get-mdn', shortname: 'fetch-metadata' }, sender(1))).toEqual({ mdn: null });
  });

  it('answers get-mdn with null for a stored copy whose indexes fit no page', async () => {
    const mdn = { content: { commit: 'a'.repeat(40), date: '2026-10-18' }, types: [], pages: [], specs: { 'fetch-metadata': [3] } };
    const h = createHandlers(deps({ sources: fakeSources({ mdn }) }));
    expect(await h.handle({ type: 'get-mdn', shortname: 'fetch-metadata' }, sender(1))).toEqual({ mdn: null });
  });

  it("answers get-caniuse with the spec's features, its series' current level's, or null", async () => {
    const source = { version: '1.0.30001816', updated: '2026-10-13' };
    const feature = (title: string) => ({ title, usage: 90, runs: { firefox: [], safari: [], chrome: [{ from: '42', to: '154', support: 'y', current: true }] }, notes: {} });
    const caniuse = { caniuse: source, features: { b: feature('B'), a: feature('A'), aria: feature('ARIA') }, specs: { 'fetch-metadata': ['b', 'a'], 'wai-aria-1.2': ['aria'] } };
    const h = createHandlers(deps({ sources: fakeSources({ caniuse }) }));
    expect(await h.handle({ type: 'get-caniuse', shortname: 'fetch-metadata' }, sender(1))).toEqual({
      caniuse: { features: [{ ...feature('A'), id: 'a' }, { ...feature('B'), id: 'b' }], source },
    });
    expect(await h.handle({ type: 'get-caniuse', shortname: 'wai-aria-1.3' }, sender(1))).toEqual({
      caniuse: { features: [{ ...feature('ARIA'), id: 'aria' }], source, fromSeries: { shortname: 'wai-aria-1.2', title: 'WAI-ARIA 1.2' } },
    });
    expect(await h.handle({ type: 'get-caniuse', shortname: 'css-grid-3' }, sender(1))).toEqual({ caniuse: null });
    expect(await h.handle({ type: 'get-caniuse', shortname: 'constructor' }, sender(1))).toEqual({ caniuse: null });
  });

  it('answers get-caniuse with null when the Can I Use file fails to load', async () => {
    const load = vi.fn(async (name: string) => {
      if (name === 'caniuse') throw new Error('offline');
      return { data: ({ specs, groups, repos } as Record<string, unknown>)[name], fetchedAt: 1, origin: 'bundled' };
    });
    const h = createHandlers(deps({ sources: { load } as unknown as Sources }));
    expect(await h.handle({ type: 'get-caniuse', shortname: 'fetch-metadata' }, sender(1))).toEqual({ caniuse: null });
  });

  it('answers get-caniuse with null for a stored copy whose features fit nothing', async () => {
    const caniuse = { caniuse: { version: 'v', updated: '2026-10-13' }, features: { a: { title: 'A' } }, specs: { 'fetch-metadata': ['a'] } };
    const h = createHandlers(deps({ sources: fakeSources({ caniuse }) }));
    expect(await h.handle({ type: 'get-caniuse', shortname: 'fetch-metadata' }, sender(1))).toEqual({ caniuse: null });
    const noSource = { features: {}, specs: {} };
    const h2 = createHandlers(deps({ sources: fakeSources({ caniuse: noSource }) }));
    expect(await h2.handle({ type: 'get-caniuse', shortname: 'fetch-metadata' }, sender(1))).toEqual({ caniuse: null });
  });

  const wptRuns = { firefox: { id: 2, version: '158.0', os: 'linux' }, safari: { id: 3, version: '27.0', os: 'mac' }, chrome: { id: 1, version: '155.0', os: 'linux' } };
  const wptStats = { tests: 2, pass: { firefox: [2, 2], safari: [1, 2], chrome: [2, 2] }, interop: 50, only: { firefox: 0, safari: 1, chrome: 0 } };

  it("answers get-wpt with the spec's results, its series' current level's, or null", async () => {
    const own = { paths: ['fetch/metadata'], all: wptStats };
    const aria = { paths: ['wai-aria'], all: wptStats };
    const wpt = { runs: wptRuns, revision: '23b0b89b1a', date: '2026-10-18', specs: { 'fetch-metadata': own, 'wai-aria-1.2': aria } };
    const h = createHandlers(deps({ sources: fakeSources({ wpt }) }));
    const meta = { runs: wptRuns, revision: '23b0b89b1a', date: '2026-10-18' };
    expect(await h.handle({ type: 'get-wpt', shortname: 'fetch-metadata' }, sender(1))).toEqual({ wpt: { spec: own, ...meta } });
    expect(await h.handle({ type: 'get-wpt', shortname: 'wai-aria-1.3' }, sender(1))).toEqual({
      wpt: { spec: aria, ...meta, fromSeries: { shortname: 'wai-aria-1.2', title: 'WAI-ARIA 1.2' } },
    });
    expect(await h.handle({ type: 'get-wpt', shortname: 'css-grid-3' }, sender(1))).toEqual({ wpt: null });
    expect(await h.handle({ type: 'get-wpt', shortname: 'constructor' }, sender(1))).toEqual({ wpt: null });
  });

  it('answers get-wpt with null when the file fails to load, lacks its runs, or has an entry that fits nothing', async () => {
    const load = vi.fn(async (name: string) => {
      if (name === 'wpt') throw new Error('offline');
      return { data: ({ specs, groups, repos } as Record<string, unknown>)[name], fetchedAt: 1, origin: 'bundled' };
    });
    expect(await createHandlers(deps({ sources: { load } as unknown as Sources })).handle({ type: 'get-wpt', shortname: 'fetch-metadata' }, sender(1))).toEqual({ wpt: null });
    const noRuns = { revision: '23b0b89b1a', date: '2026-10-18', specs: { 'fetch-metadata': { paths: ['fetch/metadata'], all: wptStats } } };
    expect(await createHandlers(deps({ sources: fakeSources({ wpt: noRuns }) })).handle({ type: 'get-wpt', shortname: 'fetch-metadata' }, sender(1))).toEqual({ wpt: null });
    const misfit = { runs: wptRuns, revision: '23b0b89b1a', date: '2026-10-18', specs: { 'fetch-metadata': { paths: ['fetch/metadata'] } } };
    expect(await createHandlers(deps({ sources: fakeSources({ wpt: misfit }) })).handle({ type: 'get-wpt', shortname: 'fetch-metadata' }, sender(1))).toEqual({ wpt: null });
  });
});

describe('review messages', () => {
  const none = {} as chrome.runtime.MessageSender;
  const c = {
    id: 'a', kind: 'comment', title: '', text: 'x', url: 'https://fetch.spec.whatwg.org/',
    quote: { exact: 'x', prefix: '', suffix: '' }, excerpt: 'x', where: {}, position: 0, created: 1, updated: 1,
  };

  it("answers a spec's review with its title and where its issues go", async () => {
    const h = createHandlers(deps());
    expect(await h.handle({ type: 'get-review', shortname: 'fetch' }, none)).toEqual({
      review: null, title: 'Fetch Standard', target: { repo: 'https://github.com/whatwg/fetch' },
    });
    await h.handle({ type: 'save-comment', shortname: 'fetch', comment: c }, none);
    expect(await h.handle({ type: 'get-review', shortname: 'fetch' }, none)).toMatchObject({
      review: { shortname: 'fetch', title: 'Fetch Standard', comments: [c] },
    });
  });

  it("puts the shortname in front of an issue's title for a repository of more than one spec series", async () => {
    const grid = specs.find((s) => s.shortname === 'css-grid-3')!;
    const flexbox = { ...grid, shortname: 'css-flexbox-1', series: { shortname: 'css-flexbox', currentSpecification: 'css-flexbox-1' } };
    const h = createHandlers(deps({ sources: fakeSources({ specs: [...specs, flexbox] }) }));
    expect(((await h.handle({ type: 'get-review', shortname: 'css-grid-3' }, none)) as { target: unknown }).target).toEqual({
      repo: 'https://github.com/w3c/csswg-drafts', prefix: '[css-grid-3]',
    });
    expect(((await h.handle({ type: 'get-review', shortname: 'css-grid-2' }, none)) as { target: unknown }).target).toEqual({
      repo: 'https://github.com/w3c/csswg-drafts', prefix: '[css-grid-2]',
    });
    const solo = createHandlers(deps());
    expect(((await solo.handle({ type: 'get-review', shortname: 'css-grid-3' }, none)) as { target: unknown }).target).toEqual({
      repo: 'https://github.com/w3c/csswg-drafts',
    });
  });

  it('falls back to the repository the page links to, for a spec browser-specs gives none', async () => {
    const fetch = specs.find((s) => s.shortname === 'fetch')!;
    const bare = { ...fetch, shortname: 'bare', url: 'https://example.org/bare/', nightly: { url: 'https://example.org/bare/', alternateUrls: [] } };
    const h = createHandlers(deps({ sources: fakeSources({ specs: [...specs, bare] }) }));
    await h.handle({ type: 'page-facts', facts: { kind: 'spec', url: 'https://example.org/bare/', repoUrl: 'https://github.com/example/bare' } }, sender(5));
    expect(await h.handle({ type: 'get-review', shortname: 'bare', tabId: 5 }, none)).toMatchObject({ target: { repo: 'https://github.com/example/bare' } });
    expect(await h.handle({ type: 'get-review', shortname: 'bare' }, none)).toMatchObject({ target: null });
  });

  it('refuses a comment of the wrong shape, and deletes comments and reviews', async () => {
    const h = createHandlers(deps());
    await expect(h.handle({ type: 'save-comment', shortname: 'fetch', comment: { ...c, kind: 'blocker' } }, none)).rejects.toThrow('not a review comment');
    await h.handle({ type: 'save-comment', shortname: 'fetch', comment: c }, none);
    await h.handle({ type: 'save-comment', shortname: 'fetch', comment: { ...c, id: 'b' } }, none);
    expect(await h.handle({ type: 'mark-filed', shortname: 'fetch', ids: ['b'] }, none)).toMatchObject({
      review: { comments: [{ id: 'a' }, { id: 'b', filed: Date.UTC(2026, 9, 21) }] },
    });
    expect(await h.handle({ type: 'delete-comment', shortname: 'fetch', id: 'a' }, none)).toMatchObject({ review: { comments: [{ id: 'b' }] } });
    expect(await h.handle({ type: 'delete-review', shortname: 'fetch' }, none)).toEqual({ ok: true });
    expect(await h.handle({ type: 'get-review', shortname: 'fetch' }, none)).toMatchObject({ review: null });
  });
});
