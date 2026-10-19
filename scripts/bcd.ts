// Downloads what the website's data files are built from: the latest release of MDN's browser-compat-data (BCD), at the
// exact version the npm registry names, so a new release reaches the files as soon as npm has it, and browser-specs.
// And it builds the browser-support file, implementations.json: Which browser engines implement each spec.
import { slimSpecs } from '../src/data/slim.ts';
import { URLS } from '../src/data/urls.ts';
import { buildImplementations } from '../src/logic/implementations.ts';
import type { SlimSpec } from '../src/shared/types.ts';
import type { Fetch } from './site.ts';

export const BCD_LATEST = 'https://registry.npmjs.org/@mdn/browser-compat-data/latest';
export const bcdDataUrl = (version: string) => `https://cdn.jsdelivr.net/npm/@mdn/browser-compat-data@${version}/data.json`;

// BCD matches about 450 specs, so far fewer means its spec URLs have changed shape, and the matching no longer works.
export const MIN_SPECS = 300;

export interface BuildInputs {
  bcdVersion: string;
  bcdUrl: string;
  bcd: unknown;
  specs: SlimSpec[];
}

export async function getJson(fetchUrl: Fetch, url: string): Promise<unknown> {
  const res = await fetchUrl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function fetchBuildInputs(fetchUrl: Fetch = fetch): Promise<BuildInputs> {
  const { version } = (await getJson(fetchUrl, BCD_LATEST)) as { version?: unknown };
  if (typeof version !== 'string') throw new Error(`no version in ${BCD_LATEST}`);
  const url = bcdDataUrl(version);
  const bcd = (await getJson(fetchUrl, url)) as { __meta?: { version?: unknown } };
  if (bcd.__meta?.version !== version) throw new Error(`${url} has BCD ${String(bcd.__meta?.version)}, not ${version}`);
  return { bcdVersion: version, bcdUrl: url, bcd, specs: slimSpecs(await getJson(fetchUrl, URLS.specs)) };
}

export function implementationsText(inputs: BuildInputs, minSpecs = MIN_SPECS): string {
  const file = buildImplementations(inputs.bcd, inputs.specs);
  const count = Object.keys(file.specs).length;
  if (count < minSpecs) throw new Error(`BCD ${inputs.bcdVersion} matched only ${count} specs, fewer than ${minSpecs}`);
  return JSON.stringify(file);
}
