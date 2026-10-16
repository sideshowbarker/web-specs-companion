import type { RepoMap, SlimGroup, SlimSpec } from '../../src/shared/types.ts';

const base = { organization: 'W3C', standing: 'good', groups: [] as SlimSpec['groups'] };

export const specs: SlimSpec[] = [
  {
    ...base,
    shortname: 'fetch-metadata',
    title: 'Fetch Metadata Request Headers',
    url: 'https://www.w3.org/TR/fetch-metadata/',
    series: { shortname: 'fetch-metadata', currentSpecification: 'fetch-metadata', releaseUrl: 'https://www.w3.org/TR/fetch-metadata/', nightlyUrl: 'https://w3c.github.io/webappsec-fetch-metadata/' },
    nightly: { url: 'https://w3c.github.io/webappsec-fetch-metadata/', status: "Editor's Draft", repository: 'https://github.com/w3c/webappsec-fetch-metadata', alternateUrls: [] },
    release: { url: 'https://www.w3.org/TR/fetch-metadata/', status: 'Working Draft' },
    groups: [{ name: 'Web Application Security Working Group', url: 'https://www.w3.org/groups/wg/webappsec/' }],
  },
  {
    ...base,
    shortname: 'wai-aria-1.2',
    title: 'WAI-ARIA 1.2',
    url: 'https://www.w3.org/TR/wai-aria-1.2/',
    series: { shortname: 'wai-aria', currentSpecification: 'wai-aria-1.2', releaseUrl: 'https://www.w3.org/TR/wai-aria/', nightlyUrl: 'https://w3c.github.io/aria/' },
    seriesNext: 'wai-aria-1.3',
    nightly: { url: 'https://w3c.github.io/aria/', status: "Editor's Draft", repository: 'https://github.com/w3c/aria', alternateUrls: [] },
    release: { url: 'https://www.w3.org/TR/wai-aria-1.2/', status: 'Recommendation' },
    groups: [{ name: 'Accessible Rich Internet Applications Working Group', url: 'https://www.w3.org/WAI/about/groups/ariawg/' }],
  },
  {
    ...base,
    shortname: 'wai-aria-1.3',
    title: 'WAI-ARIA 1.3',
    url: 'https://www.w3.org/TR/wai-aria-1.3/',
    series: { shortname: 'wai-aria', currentSpecification: 'wai-aria-1.2', releaseUrl: 'https://www.w3.org/TR/wai-aria/', nightlyUrl: 'https://w3c.github.io/aria/' },
    seriesPrevious: 'wai-aria-1.2',
    nightly: { url: 'https://w3c.github.io/aria/', status: "Editor's Draft", repository: 'https://github.com/w3c/aria', alternateUrls: [] },
    release: { url: 'https://www.w3.org/TR/wai-aria-1.3/', status: 'Working Draft' },
    groups: [{ name: 'Accessible Rich Internet Applications Working Group', url: 'https://www.w3.org/WAI/about/groups/ariawg/' }],
  },
  {
    ...base,
    shortname: 'css-grid-3',
    title: 'CSS Grid Layout Module Level 3',
    url: 'https://www.w3.org/TR/css-grid-3/',
    series: { shortname: 'css-grid', currentSpecification: 'css-grid-2', releaseUrl: 'https://www.w3.org/TR/css-grid/', nightlyUrl: 'https://drafts.csswg.org/css-grid/' },
    seriesComposition: 'delta',
    seriesPrevious: 'css-grid-2',
    nightly: { url: 'https://drafts.csswg.org/css-grid-3/', status: "Editor's Draft", repository: 'https://github.com/w3c/csswg-drafts', alternateUrls: ['https://w3c.github.io/csswg-drafts/css-grid-3/'] },
    release: { url: 'https://www.w3.org/TR/css-grid-3/', status: 'Working Draft' },
    groups: [{ name: 'Cascading Style Sheets (CSS) Working Group', url: 'https://www.w3.org/groups/wg/css/' }],
  },
  {
    ...base,
    shortname: 'css-grid-2',
    title: 'CSS Grid Layout Module Level 2',
    url: 'https://www.w3.org/TR/css-grid-2/',
    series: { shortname: 'css-grid', currentSpecification: 'css-grid-2', releaseUrl: 'https://www.w3.org/TR/css-grid/', nightlyUrl: 'https://drafts.csswg.org/css-grid/' },
    seriesNext: 'css-grid-3',
    nightly: { url: 'https://drafts.csswg.org/css-grid-2/', status: "Editor's Draft", repository: 'https://github.com/w3c/csswg-drafts', alternateUrls: [] },
    release: { url: 'https://www.w3.org/TR/css-grid-2/', status: 'Candidate Recommendation Draft' },
    groups: [{ name: 'Cascading Style Sheets (CSS) Working Group', url: 'https://www.w3.org/groups/wg/css/' }],
  },
  {
    ...base,
    organization: 'WHATWG',
    shortname: 'html',
    title: 'HTML Standard',
    url: 'https://html.spec.whatwg.org/multipage/',
    series: { shortname: 'html', currentSpecification: 'html', nightlyUrl: 'https://html.spec.whatwg.org/multipage/' },
    nightly: {
      url: 'https://html.spec.whatwg.org/multipage/',
      status: 'Living Standard',
      repository: 'https://github.com/whatwg/html',
      alternateUrls: ['https://html.spec.whatwg.org/'],
      pages: ['https://html.spec.whatwg.org/multipage/parsing.html'],
    },
    groups: [{ name: 'HTML Workstream', url: 'https://html.spec.whatwg.org/' }],
  },
  {
    ...base,
    organization: 'WHATWG',
    shortname: 'fetch',
    title: 'Fetch Standard',
    url: 'https://fetch.spec.whatwg.org/',
    series: { shortname: 'fetch', currentSpecification: 'fetch', nightlyUrl: 'https://fetch.spec.whatwg.org/' },
    nightly: { url: 'https://fetch.spec.whatwg.org/', status: 'Living Standard', repository: 'https://github.com/whatwg/fetch', alternateUrls: [] },
    groups: [{ name: 'Fetch Workstream', url: 'https://fetch.spec.whatwg.org/' }],
    formerNames: ['fetch-old'],
  },
];

export const groups: SlimGroup[] = [
  { id: 49309, identifier: 'wg/webappsec', name: 'Web Application Security Working Group', type: 'working group', endDate: '2026-10-30' },
  { id: 83726, identifier: 'wg/aria', name: 'Accessible Rich Internet Applications Working Group', type: 'working group', endDate: '2027-01-01' },
  { id: 32061, identifier: 'wg/css', name: 'Cascading Style Sheets (CSS) Working Group', type: 'working group', endDate: '2027-11-30' },
  { id: 80485, identifier: 'cg/wicg', name: 'Web Platform Incubator Community Group', type: 'community group' },
];

export const repos: RepoMap = {
  repos: {
    'w3c/aria': ['wg/aria'],
    'w3c/webappsec-fetch-metadata': ['wg/webappsec'],
    'w3c/csswg-drafts': ['wg/css'],
  },
  owners: { w3c: 'w3c' },
};
