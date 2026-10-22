// Builds the GitHub Pages site into _site/: the pages in site/, the screenshots, the icon, a privacy page made from
// store/privacy.md, and the browser-support, MDN, Can I Use, and test-results files the extension fetches. The site's
// install steps depend on the release they link to, and on which stores list the extension, so the build asks both.
import { marked } from 'marked';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { fetchBuildInputs, implementationsText } from './bcd.ts';
import { buildCaniuseFile } from './caniuse.ts';
import { buildMdnFile } from './mdn.ts';
import { buildWptFile } from './wpt.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + '_site/';

const AMO_API = 'https://addons.mozilla.org/api/v5/addons/addon/web-specs-companion/';
const CWS_PAGE = 'https://chromewebstore.google.com/detail/hpajpmapkffhaiggemaeajpkehfnapkm';

export type Stores = { amo: boolean; cws: boolean };
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

// The npm registry and jsDelivr sometimes answer with a 502 or a 503 that clears within a minute. So, the build tries a
// fetch that fails with a server error, a 429, or a network error again after each of these waits, in ms, rather than
// failing the hourly run on a blip.
export const RETRY_DELAYS = [5_000, 15_000, 45_000];

// Wraps fetchUrl so that it tries again after each of delays, and logs each failed try. Once the tries run out, it
// resolves to the last answer, or rethrows the last error, for the caller to report.
export function retrying(fetchUrl: Fetch, delays: readonly number[] = RETRY_DELAYS): Fetch {
  return async (url, init) => {
    for (const delay of delays) {
      try {
        const res = await fetchUrl(url, init);
        if (res.status < 500 && res.status !== 429) return res;
        await res.body?.cancel();
        console.log(`HTTP ${res.status} for ${url}; trying again in ${delay / 1000}s`);
      } catch (e) {
        console.log(`${String(e)} for ${url}; trying again in ${delay / 1000}s`);
      }
      await sleep(delay);
    }
    return fetchUrl(url, init);
  };
}

// Fills each {{name}} with values[name], and resolves each <!-- if store --> or <!-- if !store --> block, up to its
// <!-- endif -->, by whether that store lists the extension. Blocks don't nest.
export function fillTemplate(html: string, values: Record<string, string>, stores: Stores): string {
  const resolved = html.replace(/<!-- if (!?)(\w+) -->([\s\S]*?)<!-- endif -->/g, (_, not: string, name: string, body: string) => {
    if (!(name in stores)) throw new Error(`unknown store "${name}" in <!-- if ${not}${name} -->`);
    if (body.includes('<!-- if ')) throw new Error(`nested block in <!-- if ${not}${name} -->`);
    return stores[name as keyof Stores] === !not ? body : '';
  });
  const stray = resolved.match(/<!-- (if [^>]*|endif) -->/);
  if (stray) throw new Error(`unmatched ${stray[0]}`);
  return resolved.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) => {
    if (!(name in values)) throw new Error(`no value for ${placeholder}`);
    return values[name];
  });
}

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false });
}

// Firefox Add-ons answers 401 for an add-on that isn't public yet, and the Chrome Web Store serves an untitled item
// page for an item that isn't published. Any other error fails the build, so the deployed site keeps what it last said.
export async function probeStores(fetchUrl: Fetch = fetch): Promise<Stores> {
  const amo = await fetchUrl(AMO_API);
  if (!amo.ok && amo.status !== 401 && amo.status !== 404) {
    throw new Error(`Firefox Add-ons answered HTTP ${amo.status} for ${AMO_API}`);
  }
  const cws = await fetchUrl(CWS_PAGE);
  if (!cws.ok && cws.status !== 404) throw new Error(`Chrome Web Store answered HTTP ${cws.status} for ${CWS_PAGE}`);
  return {
    amo: amo.ok && ((await amo.json()) as { status?: string }).status === 'public',
    cws: cws.ok && /<title>Web Specs Companion\b/.test(await cws.text()),
  };
}

async function main() {
  const pkg = JSON.parse(await readFile(root + 'package.json', 'utf8'));
  const version: string = process.env.SITE_VERSION || pkg.version;
  const zip = `https://github.com/sideshowbarker/web-specs-companion/releases/download/v${version}/web-specs-companion-${version}.zip`;
  const fetchUrl = retrying(fetch);
  const stores = await probeStores(fetchUrl);
  console.log(`Version ${version}; Firefox Add-ons lists it: ${stores.amo}; the Chrome Web Store lists it: ${stores.cws}`);
  const inputs = await fetchBuildInputs(fetchUrl);
  const implementations = implementationsText(inputs);
  const mdn = await buildMdnFile(inputs);
  const caniuse = await buildCaniuseFile(inputs, fetchUrl);
  const wpt = await buildWptFile(inputs, fetchUrl);
  await rm(out, { recursive: true, force: true });
  await mkdir(out + 'privacy', { recursive: true });
  await mkdir(out + 'data');
  await writeFile(out + 'data/implementations.json', implementations);
  await writeFile(out + 'data/mdn.json', mdn.text);
  await writeFile(out + 'data/caniuse.json', caniuse.text);
  await writeFile(out + 'data/wpt.json', wpt.text);
  const index = await readFile(root + 'site/index.html', 'utf8');
  await writeFile(out + 'index.html', fillTemplate(index, { version, zip }, stores));
  const privacy = await readFile(root + 'site/privacy.html', 'utf8');
  const policy = renderMarkdown(await readFile(root + 'store/privacy.md', 'utf8'));
  await writeFile(out + 'privacy/index.html', fillTemplate(privacy, { content: policy }, stores));
  for (const item of ['site.css', 'site.js']) await cp(root + 'site/' + item, out + item);
  await cp(root + 'screenshots', out + 'screenshots', { recursive: true });
  await cp(root + 'static/icons/128.png', out + 'icon.png');
  await cp(root + 'static/icons/32.png', out + 'favicon.png');
  console.log(out);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
