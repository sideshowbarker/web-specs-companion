// Builds caniuse.json: The caniuse features of each spec in browser-specs, with each one's support history in desktop
// Firefox, Safari, and Chrome, from caniuse's own data (caniuse-db) and web-features' mapping of caniuse IDs to specs.
// It downloads both at the exact versions the npm registry names as the latest, so a new release of either reaches the
// file as soon as npm has it.
import { buildCaniuse, CIU_BROWSERS } from '../src/logic/caniuse.ts';
import { getJson, type BuildInputs } from './bcd.ts';
import type { Fetch } from './site.ts';

export const CANIUSE_LATEST = 'https://registry.npmjs.org/caniuse-db/latest';
export const WEB_FEATURES_LATEST = 'https://registry.npmjs.org/web-features/latest';
export const caniuseDataUrl = (version: string) => `https://cdn.jsdelivr.net/npm/caniuse-db@${version}/fulldata-json/data-2.0.json`;
export const webFeaturesUrl = (version: string) => `https://cdn.jsdelivr.net/npm/web-features@${version}/data.json`;

// About 210 specs get features, so far fewer means caniuse-db, web-features, or their spec URLs have changed shape.
export const MIN_CANIUSE_SPECS = 150;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

async function latest(fetchUrl: Fetch, url: string): Promise<string> {
  const { version } = (await getJson(fetchUrl, url)) as { version?: unknown };
  if (typeof version !== 'string') throw new Error(`no version in ${url}`);
  return version;
}

export async function buildCaniuseFile(inputs: BuildInputs, fetchUrl: Fetch = fetch, minSpecs = MIN_CANIUSE_SPECS): Promise<{ url: string; text: string }> {
  const [caniuseVersion, webFeaturesVersion] = await Promise.all([latest(fetchUrl, CANIUSE_LATEST), latest(fetchUrl, WEB_FEATURES_LATEST)]);
  const url = caniuseDataUrl(caniuseVersion);
  const wfUrl = webFeaturesUrl(webFeaturesVersion);
  const [caniuse, webFeatures] = await Promise.all([getJson(fetchUrl, url), getJson(fetchUrl, wfUrl)]);
  if (!isObject(caniuse) || !isObject(caniuse.agents) || !isObject(caniuse.data) || typeof caniuse.updated !== 'number') {
    throw new Error(`${url} has no agents, data, or updated date`);
  }
  // Without a current release for each of the three browsers, every bar would read as unknown.
  for (const b of CIU_BROWSERS) {
    const agent = caniuse.agents[b];
    const list = isObject(agent) ? agent.version_list : undefined;
    if (!Array.isArray(list) || !list.some((v) => isObject(v) && v.era === 0)) throw new Error(`${url} has no current ${b} release`);
  }
  if (!isObject(webFeatures) || !isObject(webFeatures.features)) throw new Error(`${wfUrl} has no features`);
  const file = buildCaniuse(caniuse, webFeatures, inputs.specs, caniuseVersion);
  const count = Object.keys(file.specs).length;
  if (count < minSpecs) throw new Error(`caniuse-db ${caniuseVersion} matched only ${count} specs, fewer than ${minSpecs}`);
  return { url, text: JSON.stringify(file) };
}
