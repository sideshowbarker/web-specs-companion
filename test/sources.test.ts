import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSources, SOURCES, type SourceDeps } from '../src/data/sources.ts';
import { MemoryStore } from '../src/data/http.ts';

const liveSpecs = JSON.stringify([{ shortname: 'live-spec', url: 'https://x.test/live/', title: 'Live' }]);
const bundledSpecs = JSON.stringify([{ shortname: 'bundled-spec', url: 'https://x.test/b/', title: 'Bundled', series: { shortname: 'bundled-spec', currentSpecification: 'bundled-spec' }, groups: [], organization: 'W3C', standing: 'good' }]);

function deps(over: Partial<SourceDeps> = {}): SourceDeps {
  return {
    store: new MemoryStore(),
    fetchImpl: vi.fn(async () => new Response(liveSpecs)),
    now: () => 1_000,
    readBundled: vi.fn(async () => bundledSpecs),
    bundledAt: async () => 500,
    ...over,
  };
}

describe('createSources', () => {
  it('loads live data, slims it, and reports the origin', async () => {
    const s = createSources(deps());
    const r = await s.load('specs');
    expect(r.origin).toBe('live');
    expect(r.data[0].shortname).toBe('live-spec');
    expect(r.data[0].series.currentSpecification).toBe('live-spec');
  });

  it('serves a fresh stored slim copy without fetching (a restarted worker)', async () => {
    const store = new MemoryStore();
    await createSources(deps({ store })).load('specs');
    const fetchImpl = vi.fn();
    const r = await createSources(deps({ store, fetchImpl })).load('specs');
    expect(r.origin).toBe('cache');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to the stale stored copy when the live fetch fails', async () => {
    const store = new MemoryStore();
    await createSources(deps({ store })).load('specs');
    const r = await createSources(deps({
      store,
      now: () => 1_000 + 2 * 86_400_000,
      fetchImpl: vi.fn(async () => { throw new TypeError('offline'); }),
    })).load('specs');
    expect(r.origin).toBe('stale');
    expect(r.data[0].shortname).toBe('live-spec');
  });

  it('falls back to the bundled snapshot when nothing is stored and the network is down', async () => {
    const r = await createSources(deps({ fetchImpl: vi.fn(async () => new Response('', { status: 503 })) })).load('specs');
    expect(r.origin).toBe('bundled');
    expect(r.fetchedAt).toBe(500);
    expect(r.data[0].shortname).toBe('bundled-spec');
  });

  it('refetches when forced', async () => {
    const fetchImpl = vi.fn(async () => new Response(liveSpecs));
    const s = createSources(deps({ fetchImpl }));
    await s.load('specs');
    await s.load('specs', { force: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('still loads live data when the cache store fails', async () => {
    const store = { get: async () => { throw new Error('quota'); }, put: async () => { throw new Error('quota'); } };
    const r = await createSources(deps({ store })).load('specs');
    expect(r.origin).toBe('live');
  });

  it('waits two minutes before retrying a source whose live fetch failed', async () => {
    let t = 1_000;
    const fetchImpl = vi.fn(async () => { throw new TypeError('offline'); });
    const s = createSources(deps({ fetchImpl, now: () => t }));
    expect((await s.load('specs')).origin).toBe('bundled');
    t += 60_000;
    expect((await s.load('specs')).origin).toBe('bundled');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += 61_000;
    await s.load('specs');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('has a bundled snapshot of every source', () => {
    for (const src of Object.values(SOURCES)) {
      expect(() => JSON.parse(readFileSync(new URL('../' + src.bundled, import.meta.url), 'utf8')), src.bundled).not.toThrow();
    }
  });

  it('loads the browser-support file, and falls back to the bundled copy when the live one is malformed', async () => {
    const good = JSON.stringify({ bcd: { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' }, specs: { fetch: { engines: ['gecko', 'webkit', 'blink'] } } });
    const live = await createSources(deps({ fetchImpl: vi.fn(async () => new Response(good)) })).load('implementations');
    expect(live.origin).toBe('live');
    expect(live.data.bcd.version).toBe('8.1.6');
    const bundled = await createSources(deps({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ specs: {} }))),
      readBundled: vi.fn(async () => good),
    })).load('implementations');
    expect(bundled.origin).toBe('bundled');
    expect(Object.keys(bundled.data.specs)).toEqual(['fetch']);
  });

  it('loads the MDN file, and falls back to the bundled copy when the live one is malformed', async () => {
    const good = JSON.stringify({ content: { commit: 'a'.repeat(40), date: '2026-10-18' }, types: ['guide'], pages: [['Web/A', 'A', 0]], specs: { fetch: [0] } });
    const live = await createSources(deps({ fetchImpl: vi.fn(async () => new Response(good)) })).load('mdn');
    expect(live.origin).toBe('live');
    expect(live.data.specs).toEqual({ fetch: [0] });
    const bundled = await createSources(deps({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ specs: {} }))),
      readBundled: vi.fn(async () => good),
    })).load('mdn');
    expect(bundled.origin).toBe('bundled');
    expect(bundled.data.pages).toEqual([['Web/A', 'A', 0]]);
  });

  it('loads the Can I Use file, and falls back to the bundled copy when the live one is malformed', async () => {
    const good = JSON.stringify({ caniuse: { version: 'v', updated: '2026-10-13' }, features: {}, specs: {} });
    const live = await createSources(deps({ fetchImpl: vi.fn(async () => new Response(good)) })).load('caniuse');
    expect(live.origin).toBe('live');
    expect(live.data.caniuse.version).toBe('v');
    const bundled = await createSources(deps({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ specs: {} }))),
      readBundled: vi.fn(async () => good),
    })).load('caniuse');
    expect(bundled.origin).toBe('bundled');
    expect(bundled.data.caniuse.updated).toBe('2026-10-13');
  });

  it('loads the test-results file, and falls back to the bundled copy when the live one is malformed', async () => {
    const runs = { firefox: { id: 2, version: '158.0', os: 'linux' }, safari: { id: 3, version: '27.0', os: 'mac' }, chrome: { id: 1, version: '155.0', os: 'linux' } };
    const good = JSON.stringify({ runs, revision: '23b0b89b1a', date: '2026-10-18', specs: {} });
    const live = await createSources(deps({ fetchImpl: vi.fn(async () => new Response(good)) })).load('wpt');
    expect(live.origin).toBe('live');
    expect(live.data.revision).toBe('23b0b89b1a');
    const bundled = await createSources(deps({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ specs: {} }))),
      readBundled: vi.fn(async () => good),
    })).load('wpt');
    expect(bundled.origin).toBe('bundled');
    expect(bundled.data.date).toBe('2026-10-18');
  });
});
