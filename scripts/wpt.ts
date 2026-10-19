// Builds wpt.json: The web-platform-tests results of each spec in browser-specs, in wpt.fyi's latest aligned stable
// runs of Chrome, Firefox, and Safari, from each run's results summary and wpt.fyi's search for the tests that fail in
// only one browser. wpt.fyi's API sends no CORS headers, and each summary is 13.6 MB, so the extension can't do this.
import { buildWpt, WPT_BROWSERS, type WptBrowser, type WptFile, type WptRuns, type WptSummary } from '../src/logic/wpt.ts';
import { getJson, type BuildInputs } from './bcd.ts';
import type { Fetch } from './site.ts';

export const WPT_RUNS = 'https://wpt.fyi/api/runs?label=master&label=stable&product=chrome&product=firefox&product=safari&aligned';
export const WPT_SEARCH = 'https://wpt.fyi/api/search';

// About 326 specs have tests, so far fewer means wpt.fyi's summaries or browser-specs' test paths have changed shape.
export const MIN_WPT_SPECS = 250;

// Each browser fails over a thousand tests the other two pass, so far fewer means the search didn't cover these runs.
export const MIN_WPT_FAILING = 100;

// wpt.fyi's search takes the run IDs in this order, and the other two browsers' terms follow it too.
const RUN_ORDER: readonly WptBrowser[] = ['chrome', 'firefox', 'safari'];

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function parseRuns(raw: unknown): { meta: WptRuns; resultsUrls: Record<WptBrowser, string> } {
  const fail = () => new Error(`${WPT_RUNS} doesn't list one stable chrome, firefox, and safari run at one revision`);
  if (!Array.isArray(raw) || raw.length !== 3) throw fail();
  const found = new Map<string, Record<string, unknown>>();
  for (const r of raw as unknown[]) {
    if (!isObject(r) || typeof r.id !== 'number' || typeof r.browser_name !== 'string' || typeof r.browser_version !== 'string'
      || typeof r.os_name !== 'string' || typeof r.revision !== 'string' || typeof r.time_start !== 'string'
      || typeof r.results_url !== 'string' || !Array.isArray(r.labels) || !r.labels.includes('stable')) {
      throw fail();
    }
    found.set(r.browser_name, r);
  }
  const chosen = WPT_BROWSERS.map((b) => found.get(b));
  if (chosen.some((r) => !r) || new Set(chosen.map((r) => r!.revision)).size !== 1) throw fail();
  const runs = Object.fromEntries(WPT_BROWSERS.map((b) => {
    const r = found.get(b)!;
    return [b, { id: r.id as number, version: r.browser_version as string, os: r.os_name as string }];
  })) as WptFile['runs'];
  const resultsUrls = Object.fromEntries(WPT_BROWSERS.map((b) => [b, found.get(b)!.results_url as string])) as Record<WptBrowser, string>;
  const earliest = Math.min(...chosen.map((r) => Date.parse(r!.time_start as string)));
  return { meta: { runs, revision: chosen[0]!.revision as string, date: new Date(earliest).toISOString().slice(0, 10) }, resultsUrls };
}

export function searchBody(browser: WptBrowser, runs: WptFile['runs']): string {
  const others = RUN_ORDER.filter((b) => b !== browser).map((product) => ({ product, status: 'PASS' }));
  return JSON.stringify({ run_ids: RUN_ORDER.map((b) => runs[b].id), query: { and: [{ product: browser, status: { not: 'PASS' } }, ...others] } });
}

const isSummary = (v: unknown): v is WptSummary =>
  isObject(v)
  && Object.values(v).every((r) => isObject(r) && typeof r.s === 'string' && Array.isArray(r.c) && r.c.length === 2 && r.c.every((n) => typeof n === 'number'));

async function summary(fetchUrl: Fetch, url: string): Promise<WptSummary> {
  const raw = await getJson(fetchUrl, url);
  if (!isSummary(raw)) throw new Error(`${url} isn't a results summary`);
  return raw;
}

// The tests wpt.fyi's search finds failing in this browser while passing in the other two, the same search that the
// card's fails-only links open.
async function failingOnlyIn(fetchUrl: Fetch, browser: WptBrowser, runs: WptFile['runs']): Promise<string[]> {
  const res = await fetchUrl(WPT_SEARCH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: searchBody(browser, runs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${WPT_SEARCH}`);
  const body: unknown = await res.json();
  const results = isObject(body) ? body.results : undefined;
  if (!Array.isArray(results) || !results.every((r) => isObject(r) && typeof r.test === 'string')) {
    throw new Error(`${WPT_SEARCH} gave no results list for ${browser}`);
  }
  return results.map((r) => (r as { test: string }).test);
}

export async function buildWptFile(
  inputs: BuildInputs,
  fetchUrl: Fetch = fetch,
  minSpecs = MIN_WPT_SPECS,
  minFailing = MIN_WPT_FAILING,
): Promise<{ url: string; text: string }> {
  const { meta, resultsUrls } = parseRuns(await getJson(fetchUrl, WPT_RUNS));
  const [summaries, only] = await Promise.all([
    Promise.all(WPT_BROWSERS.map((b) => summary(fetchUrl, resultsUrls[b]))),
    Promise.all(WPT_BROWSERS.map((b) => failingOnlyIn(fetchUrl, b, meta.runs))),
  ]);
  WPT_BROWSERS.forEach((b, i) => {
    if (only[i].length < minFailing) throw new Error(`${WPT_SEARCH} found ${only[i].length} tests failing only in ${b}, fewer than ${minFailing}`);
  });
  const byBrowser = <T>(list: T[]) => Object.fromEntries(WPT_BROWSERS.map((b, i) => [b, list[i]])) as Record<WptBrowser, T>;
  const file = buildWpt(meta, byBrowser(summaries), byBrowser(only), inputs.specs);
  const count = Object.keys(file.specs).length;
  if (count < minSpecs) throw new Error(`wpt.fyi runs at ${meta.revision} gave tests for only ${count} specs, fewer than ${minSpecs}`);
  return { url: WPT_RUNS, text: JSON.stringify(file) };
}
