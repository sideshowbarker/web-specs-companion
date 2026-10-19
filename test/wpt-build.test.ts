import { describe, it, expect } from 'vitest';
import type { BuildInputs } from '../scripts/bcd.ts';
import { buildWptFile, searchBody, WPT_RUNS, WPT_SEARCH } from '../scripts/wpt.ts';
import type { WptBrowser } from '../src/logic/wpt.ts';
import type { SlimSpec } from '../src/shared/types.ts';

const spec = (shortname: string, testPaths: string[]): SlimSpec => ({
  shortname,
  title: shortname,
  url: `https://example.org/${shortname}/`,
  organization: 'W3C',
  standing: 'good',
  groups: [],
  series: { shortname, currentSpecification: shortname },
  tests: { repository: 'https://github.com/web-platform-tests/wpt', testPaths },
});
const inputs: BuildInputs = { bcdVersion: '8.1.6', bcdUrl: 'https://bcd.test/', bcd: {}, specs: [spec('fetch', ['fetch']), spec('battery-status', ['battery-status'])] };

const run = (id: number, browser_name: string, browser_version: string, os_name: string, time_start: string) => ({
  id, browser_name, browser_version, os_name, revision: '23b0b89b1a', time_start, labels: ['master', 'stable'], results_url: `https://storage.test/${browser_name}.json`,
});
const runsBody = () => [
  run(1, 'chrome', '155.0.8059.84', 'linux', '2026-10-18T05:38:19.077Z'),
  run(2, 'firefox', '158.0', 'linux', '2026-10-18T08:20:18.331Z'),
  run(3, 'safari', '27.0 (22625.1.29.11.27)', 'mac', '2026-10-17T23:59:00.000Z'),
];
const summary = { '/fetch/a.html': { s: 'O', c: [1, 2] }, '/battery-status/b.html': { s: 'P', c: [0, 0] } };
const runs = { firefox: { id: 2, version: '158.0', os: 'linux' }, safari: { id: 3, version: '27.0 (22625.1.29.11.27)', os: 'mac' }, chrome: { id: 1, version: '155.0.8059.84', os: 'linux' } };

type Answer = { status?: number; body: unknown };
const ok = (): Record<string, Answer> => ({
  [WPT_RUNS]: { body: runsBody() },
  'https://storage.test/chrome.json': { body: summary },
  'https://storage.test/firefox.json': { body: summary },
  'https://storage.test/safari.json': { body: summary },
});

function fake(answers: Record<string, Answer>, searches: Partial<Record<WptBrowser, Answer>> = {}) {
  const posted: string[] = [];
  const fetchUrl = async (url: string, init?: RequestInit) => {
    if (url === WPT_SEARCH && init?.method === 'POST') {
      posted.push(String(init.body));
      const browser = JSON.parse(String(init.body)).query.and[0].product as WptBrowser;
      const a = searches[browser] ?? { body: { runs: [], results: [] } };
      return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
    }
    const a = answers[url];
    return a ? new Response(JSON.stringify(a.body), { status: a.status ?? 200 }) : new Response('', { status: 404 });
  };
  return { posted, fetchUrl };
}

describe('buildWptFile', () => {
  it('builds the file from the three runs, their summaries, and the three searches', async () => {
    const f = fake(ok(), { firefox: { body: { results: [{ test: '/fetch/a.html', legacy_status: [] }] } } });
    const { url, text } = await buildWptFile(inputs, f.fetchUrl, 2, 0);
    expect(url).toBe(WPT_RUNS);
    const file = JSON.parse(text);
    expect(file.runs).toEqual(runs);
    expect([file.revision, file.date]).toEqual(['23b0b89b1a', '2026-10-17']);
    expect(Object.keys(file.specs)).toEqual(['battery-status', 'fetch']);
    expect(file.specs.fetch.all).toEqual({ tests: 1, pass: { firefox: [1, 2], safari: [1, 2], chrome: [1, 2] }, interop: 50, only: { firefox: 1, safari: 0, chrome: 0 } });
  });

  it("asks wpt.fyi's search for the tests that fail only in each browser", async () => {
    const f = fake(ok());
    await buildWptFile(inputs, f.fetchUrl, 2, 0);
    expect(f.posted.sort()).toEqual(['chrome', 'firefox', 'safari'].map((b) => searchBody(b as WptBrowser, runs)).sort());
    expect(searchBody('safari', runs)).toBe('{"run_ids":[1,2,3],"query":{"and":[{"product":"safari","status":{"not":"PASS"}},{"product":"chrome","status":"PASS"},{"product":"firefox","status":"PASS"}]}}');
  });

  it("throws when the runs aren't one stable chrome, firefox, and safari run at one revision", async () => {
    const [chrome, firefox, safari] = runsBody();
    const variants = [{}, [chrome, firefox], [chrome, firefox, safari, { ...chrome, id: 4 }], [chrome, firefox, { ...safari, revision: 'ffffffffff' }], [chrome, firefox, { ...safari, labels: ['master', 'experimental'] }], [chrome, firefox, { ...safari, id: '3' }]];
    for (const body of variants) {
      await expect(buildWptFile(inputs, fake({ ...ok(), [WPT_RUNS]: { body } }).fetchUrl, 2, 0)).rejects.toThrow(`${WPT_RUNS} doesn't list one stable chrome, firefox, and safari run at one revision`);
    }
  });

  it("throws on a summary that isn't one, naming its URL", async () => {
    for (const body of [[], { '/fetch/a.html': { s: 'O' } }, { '/fetch/a.html': { s: 1, c: [0, 0] } }]) {
      await expect(buildWptFile(inputs, fake({ ...ok(), 'https://storage.test/firefox.json': { body } }).fetchUrl, 2, 0)).rejects.toThrow("https://storage.test/firefox.json isn't a results summary");
    }
  });

  it('throws on a search response without its results list', async () => {
    for (const body of [{ runs: [] }, { results: [{ name: '/fetch/a.html' }] }]) {
      await expect(buildWptFile(inputs, fake(ok(), { safari: { body } }).fetchUrl, 2, 0)).rejects.toThrow('https://wpt.fyi/api/search gave no results list for safari');
    }
  });

  it('throws on an HTTP error, naming the URL', async () => {
    const answers = ok();
    delete answers['https://storage.test/chrome.json'];
    await expect(buildWptFile(inputs, fake(answers).fetchUrl, 2, 0)).rejects.toThrow('HTTP 404 for https://storage.test/chrome.json');
    await expect(buildWptFile(inputs, fake(ok(), { chrome: { status: 503, body: {} } }).fetchUrl, 2, 0)).rejects.toThrow('HTTP 503 for https://wpt.fyi/api/search');
  });

  it('throws when fewer specs get tests than the floor', async () => {
    await expect(buildWptFile(inputs, fake(ok()).fetchUrl, 3, 0)).rejects.toThrow('wpt.fyi runs at 23b0b89b1a gave tests for only 2 specs, fewer than 3');
  });

  it("throws when a browser's search finds fewer tests than the floor", async () => {
    const f = fake(ok(), { firefox: { body: { results: [{ test: '/fetch/a.html' }, { test: '/fetch/b.html' }] } }, chrome: { body: { results: [{ test: '/fetch/a.html' }, { test: '/fetch/b.html' }] } } });
    await expect(buildWptFile(inputs, f.fetchUrl, 2, 2)).rejects.toThrow('https://wpt.fyi/api/search found 0 tests failing only in safari, fewer than 2');
  });
});
