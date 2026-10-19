import { describe, it, expect } from 'vitest';
import { buildMdn, type FrontMatter } from '../src/logic/mdn.ts';
import type { SlimSpec } from '../src/shared/types.ts';

const spec = (shortname: string, url: string, over: Partial<SlimSpec> = {}): SlimSpec => ({
  shortname,
  title: shortname,
  url,
  organization: 'W3C',
  standing: 'good',
  groups: [],
  series: { shortname, currentSpecification: shortname },
  ...over,
});

const FETCH = 'https://fetch.spec.whatwg.org/';
const specs = [spec('fetch', FETCH), spec('html', 'https://html.spec.whatwg.org/multipage/')];
const content = { commit: 'a'.repeat(40), date: '2026-10-18' };

const page = (slug: string, title: string, pageType?: string, over: Partial<FrontMatter> = {}): FrontMatter => ({
  title,
  slug,
  ...(pageType ? { pageType } : {}),
  specUrls: [],
  browserCompat: [],
  ...over,
});

describe('buildMdn', () => {
  it("matches a page through its spec-urls, its browser-compat keys, or a feature's mdn_url", () => {
    const bcd = {
      api: {
        Request: {
          __compat: { spec_url: `${FETCH}#request-class`, mdn_url: 'https://developer.mozilla.org/docs/Web/API/Request' },
          body: { __compat: { mdn_url: 'https://developer.mozilla.org/docs/Web/API/Request/body' } },
        },
        Headers: { __compat: { spec_url: `${FETCH}#headers-class`, mdn_url: 'https://developer.mozilla.org/docs/Web/API/Headers' } },
        Gone: { __compat: { spec_url: `${FETCH}#gone`, mdn_url: 'https://developer.mozilla.org/docs/Web/API/Gone' } },
      },
    };
    const file = buildMdn([
      page('Web/API/Fetch_API', 'Fetch API', 'web-api-overview', { specUrls: [FETCH] }),
      page('Web/API/Request', 'Request', 'web-api-interface', { browserCompat: ['api.Request'] }),
      page('Web/API/Headers', 'Headers', 'web-api-interface'),
      page('Web/API/Request/body', 'Request: body property', 'web-api-instance-property', { browserCompat: ['api.Request.body'] }),
      page('Web/API/Unrelated', 'Unrelated', 'web-api-interface', { specUrls: ['https://example.test/'] }),
    ], bcd, specs, content);
    expect(file.content).toEqual(content);
    expect(file.pages.map((p) => p[0])).toEqual(['Web/API/Fetch_API', 'Web/API/Headers', 'Web/API/Request']);
    expect(file.specs).toEqual({ fetch: [0, 1, 2] });
  });

  it("leaves out MDN's pages about itself and its learning area", () => {
    const file = buildMdn([
      page('MDN/Writing_guidelines/Howto', 'How to', 'mdn-writing-guide', { specUrls: [FETCH] }),
      page('Learn_web_development/Fetching', 'Fetching data', 'learn-module-chapter', { specUrls: [FETCH] }),
      page('MDN/Kitchensink', 'The MDN Content Kitchensink', 'web-api-interface', { specUrls: [FETCH] }),
      page('Web/API/Request', 'Request', 'web-api-interface', { specUrls: [FETCH] }),
    ], {}, specs, content);
    expect(file.pages.map((p) => p[0])).toEqual(['Web/API/Request']);
  });

  it("files a page that cites a series URL under the series' current level", () => {
    const grid = (current: string) => ({ shortname: 'css-grid', currentSpecification: current, nightlyUrl: 'https://drafts.csswg.org/css-grid/' });
    const levels = [
      spec('css-grid-1', 'https://www.w3.org/TR/css-grid-1/', { series: grid('css-grid-2') }),
      spec('css-grid-2', 'https://www.w3.org/TR/css-grid-2/', { series: grid('css-grid-2') }),
    ];
    const file = buildMdn([page('Web/CSS/Guides/Grid_layout', 'CSS grid layout', 'css-module', { specUrls: ['https://drafts.csswg.org/css-grid/'] })], {}, levels, content);
    expect(file.specs).toEqual({ 'css-grid-2': [0] });
  });

  it('lists a page once, under each spec it documents, with its page type', () => {
    const file = buildMdn([
      page('Web/HTML/Reference/Elements/a', '<a>: The Anchor element', 'html-element', {
        specUrls: ['https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element', `${FETCH}#x`],
      }),
      page('Web/API/Thing', 'Thing', undefined, { specUrls: [FETCH] }),
    ], {}, specs, content);
    expect(file.types).toEqual(['', 'html-element']);
    expect(file.pages).toEqual([['Web/API/Thing', 'Thing', 0], ['Web/HTML/Reference/Elements/a', '<a>: The Anchor element', 1]]);
    expect(file.specs).toEqual({ fetch: [0, 1], html: [1] });
  });

  it('gives the same file for the same pages in any order', () => {
    const pages = [page('Web/API/B', 'B', 'web-api-interface', { specUrls: [FETCH] }), page('Web/API/A', 'A', 'guide', { specUrls: [FETCH] })];
    const once = JSON.stringify(buildMdn(pages, {}, specs, content));
    expect(JSON.stringify(buildMdn([...pages].reverse(), {}, specs, content))).toBe(once);
  });
});
