import { describe, it, expect } from 'vitest';
import { slimSpecs, slimGroups, slimRepos, slimIdlNames } from '../src/data/slim.ts';

const rawSpec = {
  url: 'https://www.w3.org/TR/css-grid-3/',
  shortname: 'css-grid-3',
  title: 'CSS Grid Layout Module Level 3',
  shortTitle: 'CSS Grid 3',
  organization: 'W3C',
  standing: 'good',
  series: { shortname: 'css-grid', currentSpecification: 'css-grid-2', releaseUrl: 'https://www.w3.org/TR/css-grid/', nightlyUrl: 'https://drafts.csswg.org/css-grid/' },
  seriesComposition: 'delta',
  seriesPrevious: 'css-grid-2',
  seriesNext: null,
  nightly: {
    url: 'https://drafts.csswg.org/css-grid-3/',
    status: "Editor's Draft",
    alternateUrls: ['https://w3c.github.io/csswg-drafts/css-grid-3/'],
    repository: 'https://github.com/w3c/csswg-drafts',
    sourcePath: 'css-grid-3/Overview.bs',
    filename: 'index.html',
  },
  release: { url: 'https://www.w3.org/TR/css-grid-3/', status: 'Working Draft', filename: 'Overview.html' },
  groups: [{ name: 'Cascading Style Sheets (CSS) Working Group', url: 'https://www.w3.org/groups/wg/css/' }],
  tests: { repository: 'https://github.com/web-platform-tests/wpt', testPaths: ['css/css-grid'] },
  categories: ['browser'],
  source: 'w3c',
};

describe('slimSpecs', () => {
  it('keeps the fields the extension uses and drops the rest', () => {
    const [s] = slimSpecs([rawSpec]);
    expect(s).toEqual({
      shortname: 'css-grid-3',
      title: 'CSS Grid Layout Module Level 3',
      shortTitle: 'CSS Grid 3',
      url: 'https://www.w3.org/TR/css-grid-3/',
      organization: 'W3C',
      standing: 'good',
      series: { shortname: 'css-grid', currentSpecification: 'css-grid-2', nightlyUrl: 'https://drafts.csswg.org/css-grid/', releaseUrl: 'https://www.w3.org/TR/css-grid/' },
      seriesNext: undefined,
      seriesPrevious: 'css-grid-2',
      seriesComposition: 'delta',
      nightly: {
        url: 'https://drafts.csswg.org/css-grid-3/',
        status: "Editor's Draft",
        repository: 'https://github.com/w3c/csswg-drafts',
        sourcePath: 'css-grid-3/Overview.bs',
        alternateUrls: ['https://w3c.github.io/csswg-drafts/css-grid-3/'],
        pages: undefined,
      },
      release: { url: 'https://www.w3.org/TR/css-grid-3/', status: 'Working Draft', pages: undefined },
      groups: [{ name: 'Cascading Style Sheets (CSS) Working Group', url: 'https://www.w3.org/groups/wg/css/' }],
      tests: { repository: 'https://github.com/web-platform-tests/wpt', testPaths: ['css/css-grid'] },
      obsoletedBy: undefined,
      formerNames: undefined,
    });
  });

  it('skips malformed records and rejects non-arrays', () => {
    expect(slimSpecs([{ title: 'no shortname' }, rawSpec])).toHaveLength(1);
    expect(() => slimSpecs({})).toThrow(/array/);
  });
});

describe('slimGroups', () => {
  it('keeps open groups with identifiers', () => {
    const groups = slimGroups([
      { id: 49309, identifier: 'wg/webappsec', name: 'Web Application Security Working Group', type: 'working group', 'end-date': '2026-10-30', is_closed: false },
      { id: 42538, name: '(historical) Web Applications Working Group', is_closed: true, identifier: 'wg/webapps-old' },
      { id: 80485, identifier: 'cg/wicg', name: 'Web Platform Incubator Community Group', type: 'community group', 'end-date': null, is_closed: false },
    ]);
    expect(groups).toEqual([
      { id: 49309, identifier: 'wg/webappsec', name: 'Web Application Security Working Group', type: 'working group', endDate: '2026-10-30' },
      { id: 80485, identifier: 'cg/wicg', name: 'Web Platform Incubator Community Group', type: 'community group', endDate: undefined },
    ]);
  });
});

describe('slimRepos', () => {
  it('maps lowercase owner/name to group identifiers and records owner casing', () => {
    const map = slimRepos([
      { name: 'aria', owner: { login: 'w3c' }, w3cjson: { group: ['wg/aria'] }, isPrivate: false },
      { name: 'Foo', owner: { login: 'WICG' }, w3cjson: { group: ['cg/wicg'] }, isPrivate: false },
      { name: 'secret', owner: { login: 'w3c' }, w3cjson: { group: ['wg/x'] }, isPrivate: true },
      { name: 'nogroup', owner: { login: 'w3c' } },
    ]);
    expect(map).toEqual({
      repos: { 'w3c/aria': ['wg/aria'], 'wicg/foo': ['cg/wicg'] },
      owners: { w3c: 'w3c', wicg: 'WICG' },
    });
  });
});

describe('slimIdlNames', () => {
  it('keeps each name with its type', () => {
    expect(slimIdlNames({ Request: { fragment: 'idlnames/Request.idl', parsed: 'idlnamesparsed/Request.json', type: 'interface' } }))
      .toEqual({ Request: { type: 'interface' } });
  });
});
