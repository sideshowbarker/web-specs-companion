import { describe, it, expect } from 'vitest';
import { buildWpt, countTest, percent, type WptBrowser, type WptResult, type WptRuns, type WptSummary } from '../src/logic/wpt.ts';
import type { SlimSpec } from '../src/shared/types.ts';

const WPT = 'https://github.com/web-platform-tests/wpt';
const spec = (shortname: string, testPaths?: string[], excludePaths?: string[]): SlimSpec => ({
  shortname,
  title: shortname,
  url: `https://example.org/${shortname}/`,
  organization: 'W3C',
  standing: 'good',
  groups: [],
  series: { shortname, currentSpecification: shortname },
  ...(testPaths ? { tests: { repository: WPT, testPaths, ...(excludePaths ? { excludePaths } : {}) } } : {}),
});
const meta: WptRuns = {
  runs: { firefox: { id: 2, version: '158.0', os: 'linux' }, safari: { id: 3, version: '27.0 (22625.1.29.11.27)', os: 'mac' }, chrome: { id: 1, version: '155.0.8059.84', os: 'linux' } },
  revision: '23b0b89b1a',
  date: '2026-10-18',
};
const r = (s: string, p: number, n: number): WptResult => ({ s, c: [p, n] });
const summaries: Record<WptBrowser, WptSummary> = {
  firefox: { '/fetch/a.any.html': r('O', 3, 4), '/fetch/b.html': r('P', 0, 0), '/fetch/metadata/x.html': r('O', 0, 2), '/cors/c.htm': r('O', 2, 2), '/fetch-later/d.html': r('O', 1, 1) },
  safari: { '/fetch/a.any.html': r('O', 4, 4), '/fetch/b.html': r('F', 0, 0), '/fetch/metadata/x.html': r('O', 2, 2), '/cors/c.htm': r('O', 1, 2), '/fetch-later/d.html': r('O', 1, 1) },
  chrome: { '/fetch/a.any.html': r('O', 4, 4), '/fetch/metadata/x.html': r('O', 2, 2), '/cors/c.htm': r('O', 2, 2), '/fetch-later/d.html': r('O', 0, 1) },
};
const only: Record<WptBrowser, string[]> = { firefox: ['/fetch/a.any.html', '/dom/x.html'], safari: ['/cors/c.htm', '/fetch/metadata/x.html'], chrome: [] };
const specs = [
  spec('fetch', ['fetch', 'cors'], ['fetch/metadata', 'fetch/metadata/']),
  spec('fetch-later', ['fetch-later']),
  spec('fetch-2', ['/fetch/', 'fetch']),
  spec('html', ['fetch', 'fetch/metadata']),
  spec('webgpu'),
  spec('nothing', ['nothing']),
  { ...spec('cts'), tests: { repository: 'https://github.com/gpuweb/cts', testPaths: ['fetch'] } },
];

describe('buildWpt', () => {
  it('counts a test by its subtests, by its status when it has none, and as failed when a run lacks it', () => {
    expect(countTest(r('O', 3, 4))).toEqual([3, 4]);
    expect(countTest(r('P', 0, 0))).toEqual([1, 1]);
    expect(countTest(r('O', 0, 0))).toEqual([1, 1]);
    expect(countTest(r('T', 0, 0))).toEqual([0, 1]);
    expect(countTest(undefined)).toEqual([0, 1]);
  });

  it('gives 100 and 0 only for a full pass and for none at all', () => {
    expect(percent(5, 5)).toBe(100);
    expect(percent(0, 5)).toBe(0);
    expect(percent(0, 0)).toBe(0);
    expect(percent(9999, 10000)).toBe(99.9);
    expect(percent(1, 10000)).toBe(0.1);
    expect(percent(10221, 11321)).toBe(90.3);
    expect(percent(1.25, 3)).toBe(41.7);
  });

  it("works out a spec's numbers for all of its tests and for each directory, in testPaths order", () => {
    const file = buildWpt(meta, summaries, only, specs);
    expect(file.runs).toEqual(meta.runs);
    expect([file.revision, file.date]).toEqual(['23b0b89b1a', '2026-10-18']);
    expect(file.specs.fetch).toEqual({
      paths: ['fetch', 'cors'],
      exclude: ['fetch/metadata'],
      all: { tests: 3, pass: { firefox: [6, 7], safari: [5, 7], chrome: [6, 7] }, interop: 41.7, only: { firefox: 1, safari: 1, chrome: 0 } },
      dirs: [
        ['fetch', { tests: 2, pass: { firefox: [4, 5], safari: [4, 5], chrome: [4, 5] }, interop: 37.5, only: { firefox: 1, safari: 0, chrome: 0 } }],
        ['cors', { tests: 1, pass: { firefox: [2, 2], safari: [1, 2], chrome: [2, 2] }, interop: 50, only: { firefox: 0, safari: 1, chrome: 0 } }],
      ],
    });
    expect(file.specs['fetch-later']).toEqual({
      paths: ['fetch-later'],
      all: { tests: 1, pass: { firefox: [1, 1], safari: [1, 1], chrome: [0, 1] }, interop: 0, only: { firefox: 0, safari: 0, chrome: 0 } },
    });
  });

  it('normalizes and deduplicates paths, and counts a test under two of them once', () => {
    const file = buildWpt(meta, summaries, only, specs);
    expect(file.specs['fetch-2'].paths).toEqual(['fetch']);
    expect(file.specs['fetch-2'].all.tests).toBe(3);
    expect(file.specs['fetch-2'].dirs).toBeUndefined();
    expect(file.specs.html.all.tests).toBe(3);
    expect(file.specs.html.dirs!.map(([dir, s]) => [dir, s.tests])).toEqual([['fetch', 3], ['fetch/metadata', 1]]);
  });

  it('leaves out specs with no tests in the runs, or whose tests live outside WPT', () => {
    expect(Object.keys(buildWpt(meta, summaries, only, specs).specs)).toEqual(['fetch', 'fetch-2', 'fetch-later', 'html']);
  });

  it('gives the same bytes for the same inputs, whatever order the specs come in', () => {
    expect(JSON.stringify(buildWpt(meta, summaries, only, [...specs].reverse()))).toBe(JSON.stringify(buildWpt(meta, summaries, only, specs)));
  });
});
