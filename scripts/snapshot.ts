// Refreshes the data snapshots bundled in the extension, so a first run (or a run with no network) still works.
import { writeFile } from 'node:fs/promises';
import { URLS } from '../src/data/urls.ts';
import { slimGroups, slimIdlNames, slimRepos, slimSpecs } from '../src/data/slim.ts';
import { parseIcs } from '../src/data/tpac.ts';
import { fetchBuildInputs, implementationsText } from './bcd.ts';
import { buildCaniuseFile } from './caniuse.ts';
import { buildMdnFile } from './mdn.ts';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const sources: Record<string, string> = {};
async function snap(name: string, url: string, slim: (raw: unknown) => unknown) {
  const data = slim(await getJson(url));
  await writeFile(`data/${name}.json`, JSON.stringify(data));
  sources[name] = url;
  console.log(`data/${name}.json`);
}

await snap('specs', URLS.specs, slimSpecs);
await snap('groups', URLS.groups, slimGroups);
await snap('repos', URLS.repos, slimRepos);
await snap('idlnames', URLS.idlnames, slimIdlNames);
const inputs = await fetchBuildInputs();
await writeFile('data/implementations.json', implementationsText(inputs));
sources.implementations = inputs.bcdUrl;
console.log('data/implementations.json');
const mdn = await buildMdnFile(inputs);
await writeFile('data/mdn.json', mdn.text);
sources.mdn = mdn.url;
console.log('data/mdn.json');
const caniuse = await buildCaniuseFile(inputs);
await writeFile('data/caniuse.json', caniuse.text);
sources.caniuse = caniuse.url;
console.log('data/caniuse.json');
const icsRes = await fetch(URLS.tpac);
if (!icsRes.ok) throw new Error(`HTTP ${icsRes.status} for ${URLS.tpac}`);
await writeFile('data/tpac2026.json', JSON.stringify(parseIcs(await icsRes.text())));
sources.tpac = URLS.tpac;
console.log('data/tpac2026.json');
await writeFile('data/meta.json', JSON.stringify({ generatedAt: new Date().toISOString(), sources }, null, 2));
