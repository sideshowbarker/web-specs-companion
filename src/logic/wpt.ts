// The web-platform-tests results of each spec, from wpt.fyi's latest aligned stable runs: which tests are the spec's,
// how each browser does on them, wpt.fyi's interop score, and the tests that fail in only one browser. Then the card's
// formatting of those numbers, and links into wpt.fyi, each pinned to the runs the numbers came from.
import type { SlimSpec } from '../shared/types.ts';

export type WptBrowser = 'firefox' | 'safari' | 'chrome';
export const WPT_BROWSERS: readonly WptBrowser[] = ['firefox', 'safari', 'chrome'];

export interface WptStats {
  tests: number; // test files
  pass: Record<WptBrowser, [number, number]>; // [passing subtests, subtests]
  interop: number; // percent, one decimal
  only: Record<WptBrowser, number>; // tests wpt.fyi's search finds failing in that browser alone
}

export interface WptSpec {
  paths: string[]; // the spec's test directories that have tests, in browser-specs' order
  exclude?: string[]; // the spec's excludePaths; left out when there are none
  all: WptStats;
  dirs?: [string, WptStats][]; // per test directory with tests, in paths order; left out when there's just one
}

export interface WptRun {
  id: number;
  version: string;
  os: string; // as wpt.fyi names it, e.g. 'linux', 'mac'
}

export interface WptFile {
  runs: Record<WptBrowser, WptRun>;
  revision: string; // the WPT commit all three ran
  date: string; // YYYY-MM-DD the earliest of the three runs started
  specs: Record<string, WptSpec>; // by browser-specs shortname
}

export type WptRuns = Pick<WptFile, 'runs' | 'revision' | 'date'>;
export type WptResult = { s: string; c: [number, number] };
export type WptSummary = Record<string, WptResult>;

const WPT_REPO = 'https://github.com/web-platform-tests/wpt';

// A test's [passing, total] subtests in one run. A test with no subtests, such as a reftest, counts as one subtest that
// passes when its status does, and a test the run lacks counts as failed there.
export function countTest(result: WptResult | undefined): [number, number] {
  if (!result) return [0, 1];
  const [passing, total] = result.c;
  if (total > 0) return [passing, total];
  return result.s === 'P' || result.s === 'O' ? [1, 1] : [0, 1];
}

// Only a full pass is 100 and only no passes is 0, so a browser failing one subtest in thousands never reads as 100.
export function percent(part: number, whole: number): number {
  if (whole <= 0 || part <= 0) return 0;
  if (part >= whole) return 100;
  return Math.min(99.9, Math.max(0.1, Math.round((1000 * part) / whole) / 10));
}

// browser-specs writes a directory with or without its slashes, and sometimes lists one twice.
const unique = (paths: string[]) => [...new Set(paths.map((p) => p.split('/').filter(Boolean).join('/')).filter(Boolean))];

export function buildWpt(meta: WptRuns, summaries: Record<WptBrowser, WptSummary>, only: Record<WptBrowser, string[]>, specs: SlimSpec[]): WptFile {
  const names = [...new Set(WPT_BROWSERS.flatMap((b) => Object.keys(summaries[b])))];
  const onlySets = Object.fromEntries(WPT_BROWSERS.map((b) => [b, new Set(only[b])])) as Record<WptBrowser, Set<string>>;

  const stats = (tests: string[]): WptStats => {
    const pass = Object.fromEntries(WPT_BROWSERS.map((b) => [b, [0, 0]])) as Record<WptBrowser, [number, number]>;
    let lowest = 0;
    for (const name of tests) {
      let min = 1;
      for (const b of WPT_BROWSERS) {
        const [passing, total] = countTest(summaries[b][name]);
        pass[b][0] += passing;
        pass[b][1] += total;
        min = Math.min(min, passing / total);
      }
      lowest += min;
    }
    const onlyCounts = Object.fromEntries(WPT_BROWSERS.map((b) => [b, tests.filter((t) => onlySets[b].has(t)).length])) as Record<WptBrowser, number>;
    return { tests: tests.length, pass, interop: percent(lowest, tests.length), only: onlyCounts };
  };

  const entries: [string, WptSpec][] = [];
  const byName = [...specs].sort((a, b) => (a.shortname < b.shortname ? -1 : a.shortname > b.shortname ? 1 : 0));
  for (const { shortname, tests: t } of byName) {
    if (t?.repository !== WPT_REPO || !t.testPaths) continue;
    const exclude = unique(t.excludePaths ?? []);
    const kept = (name: string) => !exclude.some((e) => name.startsWith(`/${e}/`));
    const dirs: [string, string[]][] = [];
    for (const path of unique(t.testPaths)) {
      const tests = names.filter((name) => name.startsWith(`/${path}/`) && kept(name));
      if (tests.length > 0) dirs.push([path, tests]);
    }
    if (dirs.length === 0) continue;
    const all = [...new Set(dirs.flatMap(([, tests]) => tests))];
    entries.push([
      shortname,
      {
        paths: dirs.map(([path]) => path),
        ...(exclude.length > 0 ? { exclude } : {}),
        all: stats(all),
        ...(dirs.length > 1 ? { dirs: dirs.map(([path, tests]): [string, WptStats] => [path, stats(tests)]) } : {}),
      },
    ]);
  }
  return { runs: meta.runs, revision: meta.revision, date: meta.date, specs: Object.fromEntries(entries) };
}
