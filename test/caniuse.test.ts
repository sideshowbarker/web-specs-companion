import { describe, it, expect } from 'vitest';
import { buildCaniuse, buildRuns, type CiuVersion } from '../src/logic/caniuse.ts';
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

const at = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000;
const versions = (list: [string, string | null, number][]): CiuVersion[] =>
  list.map(([version, date, era]) => ({ version, release_date: date ? at(date) : null, era }));

describe('buildRuns', () => {
  it('merges versions with the same code, ends past runs at the current release, and keeps betas apart', () => {
    const v = versions([['1', '2015-01-10', -3], ['2', '2015-03-01', -2], ['3', '2015-06-01', -1], ['4', '2015-09-01', 0], ['5', null, 1], ['6', null, 2]]);
    expect(buildRuns(v, { 1: 'n', 2: 'n', 3: 'y', 4: 'y', 5: 'y', 6: 'y' })).toEqual([
      { from: '1', to: '2', support: 'n', month: '2015-01' },
      { from: '3', to: '4', support: 'y', month: '2015-06', current: true },
      { from: '5', to: '6', support: 'y', beta: true },
    ]);
  });

  it('reads flags, prefixes, and notes, counts a polyfill as no, and splits runs whose notes differ', () => {
    const v = versions([['1', '2010-01-01', -5], ['2', '2011-01-01', -4], ['3', '2012-01-01', -3], ['4', '2013-01-01', -2], ['5', '2014-01-01', -1], ['6', '2015-01-01', 0]]);
    expect(buildRuns(v, { 1: 'p', 2: 'n d #1', 3: 'a x #2 #3', 4: 'a x #2', 5: 'u', 6: 'y' })).toEqual([
      { from: '1', to: '1', support: 'n', month: '2010-01' },
      { from: '2', to: '2', support: 'n', flag: true, notes: [1], month: '2011-01' },
      { from: '3', to: '3', support: 'a', prefix: true, notes: [2, 3], month: '2012-01' },
      { from: '4', to: '4', support: 'a', prefix: true, notes: [2], month: '2013-01' },
      { from: '5', to: '5', support: 'u', month: '2014-01' },
      { from: '6', to: '6', support: 'y', month: '2015-01', current: true },
    ]);
  });

  it('counts a version with no code as unknown', () => {
    expect(buildRuns(versions([['1', '2020-01-01', 0]]), {})).toEqual([{ from: '1', to: '1', support: 'u', month: '2020-01', current: true }]);
  });
});

const FETCH = 'https://fetch.spec.whatwg.org/';
const grid = { shortname: 'css-grid', currentSpecification: 'css-grid-2', nightlyUrl: 'https://drafts.csswg.org/css-grid/' };
const specs = [
  spec('fetch', FETCH),
  spec('html', 'https://html.spec.whatwg.org/multipage/'),
  spec('css-grid-1', 'https://www.w3.org/TR/css-grid-1/', { series: grid }),
  spec('css-grid-2', 'https://www.w3.org/TR/css-grid-2/', { series: grid }),
];
const agents = {
  firefox: { version_list: versions([['39', '2015-07-01', -1], ['40', '2015-08-01', 0]]) },
  safari: { version_list: versions([['10', '2016-09-01', -1], ['10.1', '2017-03-01', 0]]) },
  chrome: { version_list: versions([['41', '2015-03-01', -1], ['42', '2015-04-01', 0]]) },
  edge: { version_list: versions([['12', '2015-07-01', 0]]) },
};
const feature = (title: string, specUrl: string) => ({
  title,
  spec: specUrl,
  usage_perc_y: 90.12,
  usage_perc_a: 2.04,
  stats: { firefox: { 39: 'a #1', 40: 'y #2' }, safari: { 10: 'n', '10.1': 'y' }, chrome: { 41: 'n d #3', 42: 'y' }, edge: { 12: 'n #4' } },
  notes_by_num: { 1: 'One.', 2: 'Two.', 3: 'Three.', 4: 'Four.' },
});
const caniuse = (data: Record<string, unknown>) => ({ agents, data, updated: at('2026-10-13') });

describe('buildCaniuse', () => {
  it('matches a feature through its own spec URL, through web-features, or through a series URL', () => {
    const data = {
      fetch: feature('Fetch', `${FETCH}#fetch-method`),
      dialog: feature('Dialog element', 'https://www.w3.org/TR/2012/WD-html5-20121025/'),
      'css-subgrid': feature('CSS Subgrid', 'https://drafts.csswg.org/css-grid/#subgrids'),
      gone: feature('Gone', 'https://example.test/gone/'),
      moved: feature('Moved', 'https://example.test/moved/'),
    };
    const webFeatures = {
      features: {
        dialog: { kind: 'feature', caniuse: ['dialog'], spec: ['https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element'] },
        moved: { kind: 'moved', caniuse: ['moved'], spec: [FETCH] },
        nothing: { kind: 'feature', spec: [FETCH] },
      },
    };
    const file = buildCaniuse(caniuse(data), webFeatures, specs, '1.0.30001816');
    expect(file.caniuse).toEqual({ version: '1.0.30001816', updated: '2026-10-13' });
    expect(Object.keys(file.features)).toEqual(['css-subgrid', 'dialog', 'fetch']);
    expect(file.specs).toEqual({ 'css-grid-2': ['css-subgrid'], fetch: ['fetch'], html: ['dialog'] });
  });

  it('keeps desktop Firefox, Safari, and Chrome, the notes a partial or flagged run cites, and the global support', () => {
    const f = buildCaniuse(caniuse({ fetch: feature('Fetch', FETCH) }), {}, specs, 'v').features.fetch;
    expect(Object.keys(f.runs)).toEqual(['firefox', 'safari', 'chrome']);
    expect(f.runs.chrome).toEqual([
      { from: '41', to: '41', support: 'n', flag: true, notes: [3], month: '2015-03' },
      { from: '42', to: '42', support: 'y', month: '2015-04', current: true },
    ]);
    expect(f.notes).toEqual({ 1: 'One.', 3: 'Three.' });
    expect(f.usage).toBe(92.2);
    expect(f.title).toBe('Fetch');
  });

  it('lists a feature under each spec it matches, and gives the same file for the same input in any order', () => {
    const webFeatures = { features: { f: { kind: 'feature', caniuse: 'fetch', spec: 'https://html.spec.whatwg.org/multipage/x.html' } } };
    const a = { fetch: feature('Fetch', FETCH), cors: feature('CORS', `${FETCH}#http-cors-protocol`) };
    const one = buildCaniuse(caniuse(a), webFeatures, specs, 'v');
    expect(one.specs).toEqual({ fetch: ['cors', 'fetch'], html: ['fetch'] });
    const b = { fetch: a.fetch, cors: a.cors };
    expect(JSON.stringify(buildCaniuse(caniuse(b), webFeatures, specs, 'v'))).toBe(JSON.stringify(one));
  });
});
