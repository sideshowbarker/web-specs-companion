import { describe, it, expect } from 'vitest';
import { BCD_LATEST, bcdDataUrl, fetchBuildInputs, implementationsText } from '../scripts/bcd.ts';
import { URLS } from '../src/data/urls.ts';

type Answers = Record<string, { status?: number; body: unknown }>;

const bcd = (version: string) => ({
  __meta: { version, timestamp: '2026-10-15T10:11:12.000Z' },
  api: { X: { __compat: { spec_url: 'https://example.test/a/#x', support: { chrome: { version_added: '1' } } } } },
});

const ok = (version = '8.1.6'): Answers => ({
  [BCD_LATEST]: { body: { name: '@mdn/browser-compat-data', version } },
  [bcdDataUrl(version)]: { body: bcd(version) },
  [URLS.specs]: { body: [{ shortname: 'a', url: 'https://example.test/a/', title: 'A', series: { shortname: 'a', currentSpecification: 'a' } }] },
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

async function build(fetchUrl: (url: string) => Promise<Response>, minSpecs: number) {
  const inputs = await fetchBuildInputs(fetchUrl);
  return { url: inputs.bcdUrl, text: implementationsText(inputs, minSpecs) };
}

describe('fetchBuildInputs and implementationsText', () => {
  it('builds the file from the exact BCD version npm names as the latest', async () => {
    const f = fake(ok());
    const { url, text } = await build(f.fetchUrl, 1);
    expect(url).toBe('https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@8.1.6/data.json');
    expect(f.asked).toContain(url);
    const file = JSON.parse(text);
    expect(file.bcd.version).toBe('8.1.6');
    expect(file.specs.a.engines).toEqual(['blink']);
  });

  it('throws when the download is a different BCD version', async () => {
    const answers = ok();
    answers[bcdDataUrl('8.1.6')] = { body: bcd('8.1.5') };
    await expect(build(fake(answers).fetchUrl, 1)).rejects.toThrow('8.1.5, not 8.1.6');
  });

  it('throws when fewer specs come out than the floor', async () => {
    await expect(build(fake(ok()).fetchUrl, 2)).rejects.toThrow('only 1 specs');
  });

  it('throws on an HTTP error', async () => {
    const answers = ok();
    answers[BCD_LATEST] = { status: 503, body: {} };
    await expect(build(fake(answers).fetchUrl, 1)).rejects.toThrow('HTTP 503');
  });
});
