import { describe, it, expect } from 'vitest';
import {
  normalizeSpecUrl, datedTrShortname, historyShortname, parseGitHubUrl, parseGroupUrl, fragmentOf,
} from '../src/shared/url.ts';

describe('normalizeSpecUrl', () => {
  it.each([
    ['http://w3c.github.io/aria/#role', 'https://w3c.github.io/aria/'],
    ['https://www.w3.org/TR/fetch-metadata', 'https://www.w3.org/TR/fetch-metadata/'],
    ['https://www.w3.org/TR/css-grid-3/Overview.html', 'https://www.w3.org/TR/css-grid-3/'],
    ['https://w3c.github.io/webappsec-fetch-metadata/index.html?x=1', 'https://w3c.github.io/webappsec-fetch-metadata/'],
    ['https://html.spec.whatwg.org/multipage/parsing.html#x', 'https://html.spec.whatwg.org/multipage/parsing.html'],
    ['https://DRAFTS.csswg.org/css-grid-3/', 'https://drafts.csswg.org/css-grid-3/'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSpecUrl(input)).toBe(expected);
  });
});

describe('datedTrShortname', () => {
  it('extracts the shortname of a dated TR snapshot', () => {
    expect(datedTrShortname('https://www.w3.org/TR/2026/WD-fetch-metadata-20260921/')).toBe('fetch-metadata');
    expect(datedTrShortname('https://www.w3.org/TR/2023/REC-wai-aria-1.2-20230606/#role')).toBe('wai-aria-1.2');
  });
  it('ignores undated TR URLs', () => {
    expect(datedTrShortname('https://www.w3.org/TR/fetch-metadata/')).toBeUndefined();
  });
});

describe('historyShortname', () => {
  it('reads /standards/history/<shortname>/', () => {
    expect(historyShortname('https://www.w3.org/standards/history/fetch-metadata/')).toBe('fetch-metadata');
    expect(historyShortname('https://www.w3.org/TR/fetch-metadata/')).toBeUndefined();
  });
});

describe('parseGitHubUrl', () => {
  it('classifies repo, issue, and PR pages', () => {
    expect(parseGitHubUrl('https://github.com/w3c/aria')).toEqual({ owner: 'w3c', repo: 'aria', nwo: 'w3c/aria', kind: 'repo' });
    expect(parseGitHubUrl('https://github.com/w3c/aria/issues/2401')).toMatchObject({ kind: 'issue', number: 2401 });
    expect(parseGitHubUrl('https://github.com/w3c/aria/pull/77/files')).toMatchObject({ kind: 'pr', number: 77 });
    expect(parseGitHubUrl('https://github.com/w3c/aria/blob/main/index.html')).toMatchObject({ kind: 'repo' });
  });
  it('rejects non-repo GitHub pages and other hosts', () => {
    expect(parseGitHubUrl('https://github.com/w3c')).toBeUndefined();
    expect(parseGitHubUrl('https://github.com/settings/profile')).toBeUndefined();
    expect(parseGitHubUrl('https://github.com/orgs/w3c/repositories')).toBeUndefined();
    expect(parseGitHubUrl('https://w3c.github.io/aria/')).toBeUndefined();
  });
});

describe('parseGroupUrl', () => {
  it('maps group pages and their subpages to identifiers', () => {
    expect(parseGroupUrl('https://www.w3.org/groups/wg/wasm/')).toBe('wg/wasm');
    expect(parseGroupUrl('https://www.w3.org/groups/wg/aria/participants')).toBe('wg/aria');
    expect(parseGroupUrl('https://www.w3.org/groups/cg/wicg/')).toBe('cg/wicg');
    expect(parseGroupUrl('https://www.w3.org/community/webextensions/')).toBe('cg/webextensions');
  });
  it('rejects the groups index and other pages', () => {
    expect(parseGroupUrl('https://www.w3.org/groups/')).toBeUndefined();
    expect(parseGroupUrl('https://www.w3.org/TR/')).toBeUndefined();
  });
});

describe('fragmentOf', () => {
  it('returns the decoded fragment', () => {
    expect(fragmentOf('https://x.org/#multipart%2Fform-data-encoding-algorithm')).toBe('multipart/form-data-encoding-algorithm');
    expect(fragmentOf('https://x.org/')).toBeUndefined();
  });
});
