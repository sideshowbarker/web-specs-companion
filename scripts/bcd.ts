// Builds the browser-support file, implementations.json: which browser engines implement each spec, worked out from
// the latest release of MDN's browser-compat-data (BCD). It downloads that release at the exact version the npm
// registry names, so a new release reaches the file as soon as npm has it.
import { slimSpecs } from '../src/data/slim.ts';
import { URLS } from '../src/data/urls.ts';
import { buildImplementations } from '../src/logic/implementations.ts';
import type { Fetch } from './site.ts';

export const BCD_LATEST = 'https://registry.npmjs.org/@mdn/browser-compat-data/latest';
export const bcdDataUrl = (version: string) => `https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@${version}/data.json`;

// BCD matches about 450 specs, so far fewer means its spec URLs have changed shape, and the matching no longer works.
export const MIN_SPECS = 300;

async function getJson(fetchUrl: Fetch, url: string): Promise<unknown> {
  const res = await fetchUrl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function buildImplementationsFile(fetchUrl: Fetch = fetch, minSpecs = MIN_SPECS): Promise<{ url: string; text: string }> {
  const { version } = (await getJson(fetchUrl, BCD_LATEST)) as { version?: unknown };
  if (typeof version !== 'string') throw new Error(`no version in ${BCD_LATEST}`);
  const url = bcdDataUrl(version);
  const bcd = (await getJson(fetchUrl, url)) as { __meta?: { version?: unknown } };
  if (bcd.__meta?.version !== version) throw new Error(`${url} has BCD ${String(bcd.__meta?.version)}, not ${version}`);
  const file = buildImplementations(bcd, slimSpecs(await getJson(fetchUrl, URLS.specs)));
  const count = Object.keys(file.specs).length;
  if (count < minSpecs) throw new Error(`BCD ${version} matched only ${count} specs, fewer than ${minSpecs}`);
  return { url, text: JSON.stringify(file) };
}
