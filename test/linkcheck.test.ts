import { describe, it, expect } from 'vitest';
import { checkLinks, suggestAnchor, type TargetData } from '../src/logic/linkcheck.ts';
import { SpecIndex } from '../src/data/specs.ts';
import { specs } from './fixtures/catalog.ts';

const si = new SpecIndex(specs);
const fetchMetadata: TargetData = {
  fragments: new Map([
    ['sec-fetch-dest-header', 'https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-dest-header'],
    ['sec-fetch-mode-header', 'https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-mode-header'],
  ]),
  dfns: [{ id: 'sec-fetch-site-header', href: 'https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-site-header', linkingText: ['Sec-Fetch-Site'], type: 'http-header', for: [], access: 'public' }],
};
const load = async (sn: string) => (sn === 'fetch-metadata' ? fetchMetadata : undefined);

describe('checkLinks', () => {
  it('reports links to anchors that the target spec no longer has, with suggestions', async () => {
    const r = await checkLinks([
      { i: 0, href: 'https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-dest-header', text: 'Sec-Fetch-Dest' },
      { i: 1, href: 'https://www.w3.org/TR/fetch-metadata/#sec-fetch-desst-header', text: 'Sec-Fetch-Dest' },
      { i: 2, href: 'https://w3c.github.io/webappsec-fetch-metadata/#old-site-id', text: 'Sec-Fetch-Site' },
      { i: 3, href: 'https://fetch.spec.whatwg.org/#self', text: 'self link' },
      { i: 4, href: 'https://example.org/#x', text: 'not a spec' },
      { i: 5, href: 'https://drafts.csswg.org/css-grid-3/#grid', text: 'grid' },
    ], 'fetch', si, load);
    expect(r.problems).toEqual([
      { i: 1, href: 'https://www.w3.org/TR/fetch-metadata/#sec-fetch-desst-header', text: 'Sec-Fetch-Dest',
        target: { shortname: 'fetch-metadata', title: 'Fetch Metadata Request Headers', url: 'https://www.w3.org/TR/fetch-metadata/' },
        suggestion: 'https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-dest-header' },
      { i: 2, href: 'https://w3c.github.io/webappsec-fetch-metadata/#old-site-id', text: 'Sec-Fetch-Site',
        target: { shortname: 'fetch-metadata', title: 'Fetch Metadata Request Headers', url: 'https://www.w3.org/TR/fetch-metadata/' },
        suggestion: 'https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-site-header' },
    ]);
    expect(r).toMatchObject({ checked: 3, skipped: 3, targets: 1 });
  });

  it('decodes fragments before comparing', async () => {
    const t: TargetData = { fragments: new Map([['a/b', 'https://x/#a%2Fb']]), dfns: [] };
    const r = await checkLinks([{ i: 0, href: 'https://w3c.github.io/webappsec-fetch-metadata/#a%2Fb', text: '' }], 'fetch', si, async () => t);
    expect(r.problems).toEqual([]);
  });
});

describe('suggestAnchor', () => {
  it('suggests nothing when no candidate is close', () => {
    expect(suggestAnchor('zzz', 'completely-different', fetchMetadata)).toBeUndefined();
  });
});
