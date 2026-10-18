import { describe, it, expect } from 'vitest';
import { matchSpecUrl, normalizeUrl, ships, specUrlIndex } from '../src/logic/implementations.ts';
import type { SlimSpec } from '../src/shared/types.ts';

const spec = (shortname: string, over: Partial<SlimSpec> = {}): SlimSpec => ({
  shortname,
  title: shortname,
  url: `https://example.test/${shortname}/`,
  organization: 'W3C',
  standing: 'good',
  groups: [],
  series: { shortname, currentSpecification: shortname },
  ...over,
});

describe('normalizeUrl', () => {
  it('drops the scheme, www., the query and fragment, index and Overview pages, and trailing slashes', () => {
    expect(normalizeUrl('https://www.w3.org/TR/css-grid-2/Overview.html#grid')).toBe('w3.org/TR/css-grid-2');
    expect(normalizeUrl('http://drafts.csswg.org/css-grid-3/index.html')).toBe('drafts.csswg.org/css-grid-3');
    expect(normalizeUrl('https://example.test/a/index.htm')).toBe('example.test/a');
    expect(normalizeUrl('https://fetch.spec.whatwg.org/?a=1#b')).toBe('fetch.spec.whatwg.org');
  });
});

describe('matchSpecUrl', () => {
  const grid = (currentSpecification: string) => ({ shortname: 'css-grid', currentSpecification, nightlyUrl: 'https://drafts.csswg.org/css-grid/' });
  const index = specUrlIndex([
    spec('a'),
    spec('a-b', { url: 'https://example.test/a/b/' }),
    spec('html', {
      url: 'https://html.spec.whatwg.org/multipage/',
      nightly: { url: 'https://html.spec.whatwg.org/multipage/', alternateUrls: ['https://html.spec.whatwg.org/'], pages: ['https://html.spec.whatwg.org/multipage/semantics.html'] },
    }),
    spec('grid-1', { url: 'https://www.w3.org/TR/css-grid-1/', series: grid('grid-2') }),
    spec('grid-2', { url: 'https://www.w3.org/TR/css-grid-2/', series: grid('grid-2') }),
    spec('series-claims-own', { series: { shortname: 's', currentSpecification: 'series-claims-own', nightlyUrl: 'https://example.test/own/' } }),
    spec('own'),
    spec('first', { nightly: { url: 'https://example.test/shared/', alternateUrls: [] } }),
    spec('second', { nightly: { url: 'https://example.test/shared/', alternateUrls: [] } }),
  ]);

  it('matches the longest URL a spec URL starts with, at a path boundary', () => {
    expect(matchSpecUrl(index, 'https://example.test/a/b/c.html#x')).toBe('a-b');
    expect(matchSpecUrl(index, 'https://example.test/a/c.html#x')).toBe('a');
    expect(matchSpecUrl(index, 'https://example.test/ab/')).toBeUndefined();
  });

  it('matches multipage pages and alternate URLs', () => {
    expect(matchSpecUrl(index, 'https://html.spec.whatwg.org/multipage/semantics.html#the-a-element')).toBe('html');
    expect(matchSpecUrl(index, 'https://html.spec.whatwg.org/#the-a-element')).toBe('html');
  });

  it("sends a series URL to the series' current level", () => {
    expect(matchSpecUrl(index, 'https://drafts.csswg.org/css-grid/#grid-template')).toBe('grid-2');
  });

  it("prefers a spec's own URL to a series URL, and otherwise the first spec to claim a URL", () => {
    expect(matchSpecUrl(index, 'https://example.test/own/#x')).toBe('own');
    expect(matchSpecUrl(index, 'https://example.test/shared/#x')).toBe('first');
  });

  it('matches nothing on a host no spec lives on', () => {
    expect(matchSpecUrl(index, 'https://unknown.test/a/')).toBeUndefined();
  });
});

describe('ships', () => {
  const v = (version_added: unknown, extra: object = {}) => ({ version_added, ...extra });
  const flag = { flags: [{ type: 'preference', name: 'x' }] };

  it('counts a release on desktop or mobile', () => {
    expect(ships({ firefox: v('120') }, 'gecko')).toBe(true);
    expect(ships({ firefox: v(false), firefox_android: v('79') }, 'gecko')).toBe(true);
    expect(ships({ safari_ios: v(true) }, 'webkit')).toBe(true);
    expect(ships({ chrome: v('1') }, 'gecko')).toBe(false);
  });

  it("doesn't count a preview, a flag, a removal, or an unknown version", () => {
    expect(ships({ chrome: v('preview') }, 'blink')).toBe(false);
    expect(ships({ chrome: v('100', flag) }, 'blink')).toBe(false);
    expect(ships({ chrome: v('51', { version_removed: '92' }) }, 'blink')).toBe(false);
    expect(ships({ chrome: v(null) }, 'blink')).toBe(false);
    expect(ships({ chrome: v(false) }, 'blink')).toBe(false);
    expect(ships({ chrome: v('') }, 'blink')).toBe(false);
    expect(ships(undefined, 'blink')).toBe(false);
  });

  it('counts an empty list of flags as no flag', () => {
    expect(ships({ chrome: v('100', { flags: [] }) }, 'blink')).toBe(true);
  });

  it('counts prefixed, alternative-name, and partial support', () => {
    expect(ships({ safari: v('3', { prefix: '-webkit-' }) }, 'webkit')).toBe(true);
    expect(ships({ firefox: v('20', { alternative_name: 'mozFoo' }) }, 'gecko')).toBe(true);
    expect(ships({ chrome: v('80', { partial_implementation: true }) }, 'blink')).toBe(true);
  });

  it('counts a list of statements when any one of them is a release', () => {
    expect(ships({ firefox: [v('100', flag), v('110')] }, 'gecko')).toBe(true);
    expect(ships({ firefox: [v('90', { prefix: '-moz-', version_removed: '95' }), v('80', flag)] }, 'gecko')).toBe(false);
  });
});
