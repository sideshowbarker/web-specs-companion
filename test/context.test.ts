import { describe, it, expect } from 'vitest';
import { SpecIndex } from '../src/data/specs.ts';
import { GroupIndex } from '../src/data/groups.ts';
import { resolveContext } from '../src/logic/context.ts';
import { specs, groups, repos } from './fixtures/catalog.ts';

const si = new SpecIndex(specs);
const gi = new GroupIndex(groups, repos);
const resolve = (url: string, facts?: Parameters<typeof resolveContext>[1]) => resolveContext(url, facts, si, gi);

describe('SpecIndex.lookup', () => {
  it("matches an editor's draft, the latest TR, and a dated TR", () => {
    expect(si.lookup('https://w3c.github.io/webappsec-fetch-metadata/#intro')).toMatchObject({ spec: { shortname: 'fetch-metadata' }, pageKind: 'ed' });
    expect(si.lookup('https://www.w3.org/TR/fetch-metadata')).toMatchObject({ spec: { shortname: 'fetch-metadata' }, pageKind: 'tr' });
    expect(si.lookup('https://www.w3.org/TR/2026/WD-fetch-metadata-20260921/')).toMatchObject({ spec: { shortname: 'fetch-metadata' }, pageKind: 'dated-tr' });
  });

  it('matches alternate URLs, Overview.html, and the unversioned series URL', () => {
    expect(si.lookup('https://w3c.github.io/csswg-drafts/css-grid-3/')?.spec.shortname).toBe('css-grid-3');
    expect(si.lookup('https://www.w3.org/TR/css-grid-3/Overview.html')?.spec.shortname).toBe('css-grid-3');
    expect(si.lookup('https://www.w3.org/TR/css-grid/')).toMatchObject({ spec: { shortname: 'css-grid-2' }, pageKind: 'tr' });
  });

  it("picks the latest level when two levels share an editor's draft, and lists the other", () => {
    const m = si.lookup('https://w3c.github.io/aria/');
    expect(m?.spec.shortname).toBe('wai-aria-1.3');
    expect(m?.others.map((s) => s.shortname)).toEqual(['wai-aria-1.2']);
  });

  it('matches every page of a multipage spec, listed or not', () => {
    expect(si.lookup('https://html.spec.whatwg.org/multipage/parsing.html#tokenization')?.spec.shortname).toBe('html');
    expect(si.lookup('https://html.spec.whatwg.org/multipage/dom.html')?.spec.shortname).toBe('html');
    expect(si.lookup('https://html.spec.whatwg.org/')?.spec.shortname).toBe('html');
  });

  it('resolves former names and returns nothing for unknown pages', () => {
    expect(si.get('fetch-old')?.shortname).toBe('fetch');
    expect(si.lookup('https://example.org/spec/')).toBeUndefined();
  });
});

describe('GroupIndex', () => {
  it('maps a spec to its group by /groups/ URL or by name', () => {
    expect(gi.forSpec(specs[0]).map((g) => g.identifier)).toEqual(['wg/webappsec']);
    expect(gi.forSpec(specs[1]).map((g) => g.identifier)).toEqual(['wg/aria']);
  });
  it('maps repos case-insensitively', () => {
    expect(gi.forRepo('W3C/ARIA').map((g) => g.identifier)).toEqual(['wg/aria']);
  });
});

describe('resolveContext', () => {
  it('resolves a spec page with its groups', () => {
    const c = resolve('https://w3c.github.io/webappsec-fetch-metadata/');
    expect(c).toMatchObject({ kind: 'spec', pageKind: 'ed', spec: { shortname: 'fetch-metadata' } });
    expect(c.groups.map((g) => g.identifier)).toEqual(['wg/webappsec']);
  });

  it('resolves GitHub repo, issue, and PR pages to the group and the specs the repo hosts', () => {
    const repo = resolve('https://github.com/w3c/aria');
    expect(repo.kind).toBe('repo');
    expect(repo.groups.map((g) => g.identifier)).toEqual(['wg/aria']);
    expect(repo.repoSpecs?.map((s) => s.shortname).sort()).toEqual(['wai-aria-1.2', 'wai-aria-1.3']);
    expect(resolve('https://github.com/w3c/aria/issues/12')).toMatchObject({ kind: 'issue', repo: { number: 12 } });
    expect(resolve('https://github.com/w3c/csswg-drafts/pull/9')).toMatchObject({ kind: 'pr' });
  });

  it('prefers the canonical repo casing from page facts', () => {
    const c = resolve('https://github.com/W3C/Aria', { kind: 'github', url: 'https://github.com/W3C/Aria', github: { nwo: 'w3c/aria' } });
    expect(c.repo?.nwo).toBe('w3c/aria');
  });

  it('resolves a w3.org group page and the specs the group delivers', () => {
    const c = resolve('https://www.w3.org/groups/wg/css/participants');
    expect(c.kind).toBe('group');
    expect(c.groups[0].identifier).toBe('wg/css');
    expect(c.repoSpecs?.map((s) => s.shortname).sort()).toEqual(['css-grid-2', 'css-grid-3']);
  });

  it('falls back to page facts for a spec browser-specs lacks', () => {
    const c = resolve('https://example.github.io/mirror/', {
      kind: 'spec', url: 'https://example.github.io/mirror/', latestUrl: 'https://www.w3.org/TR/fetch-metadata/',
    });
    expect(c).toMatchObject({ kind: 'spec', spec: { shortname: 'fetch-metadata' }, pageKind: 'unknown' });
  });

  it('keeps an unknown spec page as a spec context built from its facts alone', () => {
    const c = resolve('https://example.org/x/', {
      kind: 'spec', url: 'https://example.org/x/', title: 'Some Draft', groupUrls: ['https://www.w3.org/groups/cg/wicg/'],
    });
    expect(c.kind).toBe('spec');
    expect(c.spec).toBeUndefined();
    expect(c.groups.map((g) => g.identifier)).toEqual(['cg/wicg']);
  });

  it('returns kind none for anything else', () => {
    expect(resolve('https://example.org/').kind).toBe('none');
  });
});
