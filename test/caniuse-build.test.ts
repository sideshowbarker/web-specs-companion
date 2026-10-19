import { describe, it, expect } from 'vitest';
import type { BuildInputs } from '../scripts/bcd.ts';
import { buildCaniuseFile, CANIUSE_LATEST, caniuseDataUrl, WEB_FEATURES_LATEST, webFeaturesUrl } from '../scripts/caniuse.ts';
import type { SlimSpec } from '../src/shared/types.ts';

const spec = (shortname: string, url: string): SlimSpec => ({
  shortname,
  title: shortname,
  url,
  organization: 'W3C',
  standing: 'good',
  groups: [],
  series: { shortname, currentSpecification: shortname },
});

const inputs: BuildInputs = {
  bcdVersion: '8.1.6',
  bcdUrl: 'https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@8.1.6/data.json',
  bcd: {},
  specs: [spec('fetch', 'https://fetch.spec.whatwg.org/'), spec('battery-status', 'https://w3c.github.io/battery/')],
};

const agent = { version_list: [{ version: '1', release_date: 1420070400, era: 0 }] };
const stats = { firefox: { 1: 'y' }, safari: { 1: 'n' }, chrome: { 1: 'y' } };
const caniuseData = {
  agents: { firefox: agent, safari: agent, chrome: agent },
  data: {
    fetch: { title: 'Fetch', spec: 'https://fetch.spec.whatwg.org/', stats, notes_by_num: {}, usage_perc_y: 97, usage_perc_a: 0 },
    'battery-status': { title: 'Battery Status API', spec: 'https://www.w3.org/TR/battery-status/', stats, notes_by_num: {}, usage_perc_y: 76, usage_perc_a: 0 },
  },
  updated: 1791868323,
};
const webFeatures = { features: { battery: { kind: 'feature', caniuse: ['battery-status'], spec: ['https://w3c.github.io/battery/'] } } };

type Answers = Record<string, { status?: number; body: unknown }>;
const ok = (): Answers => ({
  [CANIUSE_LATEST]: { body: { name: 'caniuse-db', version: '1.0.30001816' } },
  [WEB_FEATURES_LATEST]: { body: { name: 'web-features', version: '3.43.0' } },
  [caniuseDataUrl('1.0.30001816')]: { body: caniuseData },
  [webFeaturesUrl('3.43.0')]: { body: webFeatures },
});

function fake(answers: Answers) {
  const asked: string[] = [];
  const fetchUrl = async (url: string) => {
    asked.push(url);
    const a = answers[url];
    return a ? new Response(JSON.stringify(a.body), { status: a.status ?? 200 }) : new Response('', { status: 404 });
  };
  return { asked, fetchUrl };
}

describe('buildCaniuseFile', () => {
  it('builds the file from the exact caniuse-db and web-features versions npm names as the latest', async () => {
    const f = fake(ok());
    const { url, text } = await buildCaniuseFile(inputs, f.fetchUrl, 2);
    expect(url).toBe('https://cdn.jsdelivr.net/npm/caniuse-db@1.0.30001816/fulldata-json/data-2.0.json');
    expect(f.asked).toContain('https://cdn.jsdelivr.net/npm/web-features@3.43.0/data.json');
    const file = JSON.parse(text);
    expect(file.caniuse).toEqual({ version: '1.0.30001816', updated: '2026-10-13' });
    expect(file.specs).toEqual({ 'battery-status': ['battery-status'], fetch: ['fetch'] });
  });

  it('throws when fewer specs get features than the floor', async () => {
    await expect(buildCaniuseFile(inputs, fake(ok()).fetchUrl, 3)).rejects.toThrow('caniuse-db 1.0.30001816 matched only 2 specs, fewer than 3');
  });

  it('throws on an HTTP error, naming the URL', async () => {
    const answers = ok();
    answers[webFeaturesUrl('3.43.0')] = { status: 503, body: {} };
    await expect(buildCaniuseFile(inputs, fake(answers).fetchUrl, 1)).rejects.toThrow('HTTP 503 for https://cdn.jsdelivr.net/npm/web-features@3.43.0/data.json');
  });

  it("throws when a download doesn't have the parts the build needs", async () => {
    const noData = ok();
    noData[caniuseDataUrl('1.0.30001816')] = { body: { agents: {} } };
    await expect(buildCaniuseFile(inputs, fake(noData).fetchUrl, 1)).rejects.toThrow(`${caniuseDataUrl('1.0.30001816')} has no agents, data, or updated date`);
    const noFeatures = ok();
    noFeatures[webFeaturesUrl('3.43.0')] = { body: {} };
    await expect(buildCaniuseFile(inputs, fake(noFeatures).fetchUrl, 1)).rejects.toThrow(`${webFeaturesUrl('3.43.0')} has no features`);
  });

  it("throws when caniuse-db has no current release for one of the three browsers", async () => {
    const answers = ok();
    answers[caniuseDataUrl('1.0.30001816')] = { body: { ...caniuseData, agents: { firefox: agent, safari: agent, chrome: { version_list: [{ version: '1', era: -1 }] } } } };
    await expect(buildCaniuseFile(inputs, fake(answers).fetchUrl, 1)).rejects.toThrow(`${caniuseDataUrl('1.0.30001816')} has no current chrome release`);
    const missing = ok();
    missing[caniuseDataUrl('1.0.30001816')] = { body: { ...caniuseData, agents: { firefox: agent, chrome: agent } } };
    await expect(buildCaniuseFile(inputs, fake(missing).fetchUrl, 1)).rejects.toThrow('has no current safari release');
  });

  it("throws when the registry doesn't name a version", async () => {
    const answers = ok();
    answers[CANIUSE_LATEST] = { body: {} };
    await expect(buildCaniuseFile(inputs, fake(answers).fetchUrl, 1)).rejects.toThrow(`no version in ${CANIUSE_LATEST}`);
  });
});
