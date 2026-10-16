import { describe, it, expect, vi } from 'vitest';
import { buildSearchItems, parseQuery, search, termSearch, webidlpediaUrl } from '../src/logic/search.ts';
import { SpecIndex } from '../src/data/specs.ts';
import { createHttp, MemoryStore } from '../src/data/http.ts';
import { specs, groups } from './fixtures/catalog.ts';

const items = buildSearchItems(specs, groups, { Request: { type: 'interface' }, RequestInit: { type: 'dictionary' } });

describe('parseQuery', () => {
  it('reads scope prefixes', () => {
    expect(parseQuery('wg  css')).toEqual({ scope: 'group', text: 'css', groupType: 'wg' });
    expect(parseQuery('group aria')).toEqual({ scope: 'group', text: 'aria', groupType: undefined });
    expect(parseQuery('idl Request')).toEqual({ scope: 'idl', text: 'Request' });
    expect(parseQuery('dfn navigate')).toEqual({ scope: 'term', text: 'navigate' });
    expect(parseQuery(' fetch metadata ')).toEqual({ scope: 'all', text: 'fetch metadata' });
  });
});

describe('search', () => {
  it('ranks an exact shortname first', () => {
    expect(search(items, 'fetch')[0]).toMatchObject({ kind: 'spec', url: 'https://fetch.spec.whatwg.org/' });
  });
  it('matches every word of a multi-word title', () => {
    expect(search(items, 'fetch metadata')[0].label).toBe('Fetch Metadata Request Headers');
  });
  it('finds groups by identifier and limits the scope', () => {
    const r = search(items, 'wg css');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'group', url: 'https://www.w3.org/groups/wg/css/' });
    expect(search(items, 'cg css')).toEqual([]);
  });
  it('finds IDL names case-insensitively, linking to webidlpedia', () => {
    expect(search(items, 'idl request')[0]).toMatchObject({ kind: 'idl', label: 'Request', url: webidlpediaUrl('Request'), idlName: 'Request' });
  });
  it('prefers the current level in a series', () => {
    const r = search(items, 'css-grid');
    expect(r[0].label).toBe('CSS Grid Layout Module Level 2');
  });
  it('returns nothing for an empty query or a term-scoped one', () => {
    expect(search(items, '   ')).toEqual([]);
    expect(search(items, 'dfn fetch')).toEqual([]);
  });
});

describe('termSearch', () => {
  it('posts the term without an id and resolves relative URIs against the defining spec', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.queries).toEqual([{ term: 'fetch' }]);
      expect(JSON.stringify(body)).not.toMatch(/"id"/);
      return new Response(JSON.stringify({ results: [{ result: [
        { shortname: 'fetch', type: 'dfn', uri: '#concept-fetch' },
        { shortname: 'html', type: 'dfn', uri: 'browsing-the-web.html#navigate' },
        { shortname: 'unknown-spec', type: 'dfn', uri: '#x' },
      ] }] }));
    });
    const http = createHttp(new MemoryStore(), fetchImpl, () => 0);
    const r = await termSearch(http, new SpecIndex(specs), 'fetch');
    expect(r.map((i) => i.url)).toEqual([
      'https://fetch.spec.whatwg.org/#concept-fetch',
      'https://html.spec.whatwg.org/multipage/browsing-the-web.html#navigate',
    ]);
    expect(r[0]).toMatchObject({ kind: 'term', label: 'fetch', detail: 'dfn · Fetch Standard' });
  });
});
