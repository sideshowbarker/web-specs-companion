import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { slimSpecs, slimGroups, slimRepos, slimIdlNames, slimImplementations, slimMdn, slimCaniuse, slimWpt } from '../src/data/slim.ts';

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

  it("keeps a spec's excludePaths", () => {
    const [s] = slimSpecs([{ ...rawSpec, tests: { ...rawSpec.tests, excludePaths: ['css/css-grid/subgrid', 7] } }]);
    expect(s.tests).toEqual({ repository: 'https://github.com/web-platform-tests/wpt', testPaths: ['css/css-grid'], excludePaths: ['css/css-grid/subgrid'] });
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

describe('slimImplementations', () => {
  const good = { bcd: { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' }, specs: {} };

  it('accepts the bundled browser-support file', () => {
    const file = slimImplementations(JSON.parse(readFileSync(new URL('../data/implementations.json', import.meta.url), 'utf8')));
    expect(file.bcd.version).toMatch(/^[0-9]+[.][0-9]+[.][0-9]+$/);
    expect(Object.keys(file.specs).length).toBeGreaterThan(300);
  });

  it('rejects a file without a BCD version, a timestamp, or specs', () => {
    expect(slimImplementations(good)).toEqual(good);
    expect(() => slimImplementations({ ...good, bcd: { timestamp: good.bcd.timestamp } })).toThrow(/implementations/);
    expect(() => slimImplementations({ ...good, bcd: { version: '8.1.6' } })).toThrow(/implementations/);
    expect(() => slimImplementations({ bcd: good.bcd })).toThrow(/implementations/);
    expect(() => slimImplementations({ ...good, specs: [] })).toThrow(/implementations/);
    expect(() => slimImplementations(null)).toThrow(/implementations/);
  });

  it('drops each record that another build of the generator shaped differently, and keeps every bundled one', () => {
    const rec = { engines: ['webkit', 'blink'], basis: 'shared', core: 2, ships: { gecko: 0, webkit: 2, blink: 2 }, lacks: { gecko: { features: [{ key: 'api.A' }], more: 0 } } };
    const file = slimImplementations({
      ...good,
      specs: {
        fine: rec,
        number: 5,
        noEngines: { ...rec, engines: undefined },
        oddEngine: { ...rec, engines: ['presto'] },
        oddBasis: { ...rec, basis: 'most' },
        noShips: { ...rec, ships: undefined },
        noLacks: { ...rec, lacks: undefined },
        oddLacks: { ...rec, lacks: { gecko: {} } },
        oddFeature: { ...rec, lacks: { gecko: { features: [{}], more: 0 } } },
      },
    });
    expect(Object.keys(file.specs)).toEqual(['fine']);
    const raw = JSON.parse(readFileSync(new URL('../data/implementations.json', import.meta.url), 'utf8'));
    expect(Object.keys(slimImplementations(raw).specs)).toHaveLength(Object.keys(raw.specs).length);
  });
});

describe('slimMdn', () => {
  const good = { content: { commit: 'a'.repeat(40), date: '2026-10-18' }, types: [], pages: [], specs: {} };

  it('accepts the bundled MDN file', () => {
    const file = slimMdn(JSON.parse(readFileSync(new URL('../data/mdn.json', import.meta.url), 'utf8')));
    expect(file.content.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(file.specs).length).toBeGreaterThan(300);
  });

  it('rejects a file without its commit and date, or its types, pages, or specs', () => {
    expect(slimMdn(good)).toEqual(good);
    for (const bad of [
      { ...good, content: { date: '2026-10-18' } },
      { ...good, content: { commit: 'a' } },
      { ...good, types: {} },
      { ...good, pages: {} },
      { ...good, specs: [] },
      null,
    ]) {
      expect(() => slimMdn(bad)).toThrow(/mdn/);
    }
  });

  it('drops each malformed page and index, and each spec left with no pages', () => {
    const file = slimMdn({
      ...good,
      types: ['guide', 7],
      pages: [['a', 'A', 0], ['b', 'B', 1], ['c', 3, 0], 'd', ['e', 'E', 0]],
      specs: { x: [0, 1, 2, 3, 4, 9, '0'], y: [1], z: 'nope' },
    });
    expect(file.pages).toEqual([['a', 'A', 0], ['e', 'E', 0]]);
    expect(file.specs).toEqual({ x: [0, 1] });
  });
});

describe('slimCaniuse', () => {
  const good = { caniuse: { version: '1.0.30001816', updated: '2026-10-13' }, features: {}, specs: {} };
  const feature = { title: 'Fetch', usage: 97.3, runs: { firefox: [], safari: [], chrome: [{ from: '42', to: '154', support: 'y', month: '2015-04', current: true }] }, notes: {} };

  it('accepts the bundled Can I Use file', () => {
    const file = slimCaniuse(JSON.parse(readFileSync(new URL('../data/caniuse.json', import.meta.url), 'utf8')));
    expect(file.caniuse.updated).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
    expect(Object.keys(file.specs).length).toBeGreaterThan(150);
  });

  it("rejects a file without caniuse-db's version and date, or its features or specs", () => {
    expect(slimCaniuse(good)).toEqual(good);
    for (const bad of [
      { ...good, caniuse: { updated: '2026-10-13' } },
      { ...good, caniuse: { version: 'v' } },
      { ...good, features: [] },
      { ...good, specs: [] },
      null,
    ]) {
      expect(() => slimCaniuse(bad)).toThrow(/caniuse/);
    }
  });

  it("drops each feature whose shape doesn't fit, and each spec left with none", () => {
    const file = slimCaniuse({
      ...good,
      features: { fetch: feature, bad: { ...feature, runs: { firefox: [] } } },
      specs: { fetch: ['fetch', 'bad', 'gone', 7], html: ['bad'], dom: 'nope' },
    });
    expect(Object.keys(file.features)).toEqual(['fetch']);
    expect(file.specs).toEqual({ fetch: ['fetch'] });
  });
});

describe('slimWpt', () => {
  const runs = { firefox: { id: 2, version: '158.0', os: 'linux' }, safari: { id: 3, version: '27.0', os: 'mac' }, chrome: { id: 1, version: '155.0', os: 'linux' } };
  const good = { runs, revision: '23b0b89b1a', date: '2026-10-18', specs: {} };
  const stats = { tests: 1, pass: { firefox: [1, 1], safari: [0, 1], chrome: [1, 1] }, interop: 0, only: { firefox: 0, safari: 1, chrome: 0 } };

  it('accepts the bundled file', () => {
    const file = slimWpt(JSON.parse(readFileSync(new URL('../data/wpt.json', import.meta.url), 'utf8')));
    expect(file.date).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
    expect(Object.keys(file.specs).length).toBeGreaterThan(250);
  });

  it('rejects a file without the three runs, the revision, the date, or the specs', () => {
    for (const bad of [null, { ...good, runs: { firefox: runs.firefox, chrome: runs.chrome } }, { ...good, revision: 7 }, { ...good, date: undefined }, { ...good, specs: [] }]) {
      expect(() => slimWpt(bad)).toThrow(/wpt/);
    }
  });

  it("drops each spec entry whose shape doesn't fit", () => {
    const file = slimWpt({ ...good, extra: 1, specs: { fetch: { paths: ['fetch'], all: stats }, bad: { paths: ['x'] } } });
    expect(file).toEqual({ runs, revision: '23b0b89b1a', date: '2026-10-18', specs: { fetch: { paths: ['fetch'], all: stats } } });
  });
});
