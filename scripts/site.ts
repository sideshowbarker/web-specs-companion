// Builds the GitHub Pages site into _site/: the pages in site/, the screenshots, the icon, a privacy page made from
// store/privacy.md, and the browser-support file the extension fetches. The install steps on the pages depend on the
// release they link to, and on which stores list the extension, so the build asks both stores.
import { marked } from 'marked';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildImplementationsFile } from './bcd.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + '_site/';

const AMO_API = 'https://addons.mozilla.org/api/v5/addons/addon/w3c-companion/';
const CWS_PAGE = 'https://chromewebstore.google.com/detail/hpajpmapkffhaiggemaeajpkehfnapkm';

export type Stores = { amo: boolean; cws: boolean };
export type Fetch = (url: string) => Promise<Response>;

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
    cws: cws.ok && /<title>W3C Companion\b/.test(await cws.text()),
  };
}

async function main() {
  const pkg = JSON.parse(await readFile(root + 'package.json', 'utf8'));
  const version: string = process.env.SITE_VERSION || pkg.version;
  const zip = `https://github.com/w3c-oss/w3c-companion/releases/download/v${version}/w3c-companion-${version}.zip`;
  const stores = await probeStores();
  console.log(`Version ${version}; Firefox Add-ons lists it: ${stores.amo}; the Chrome Web Store lists it: ${stores.cws}`);
  const implementations = await buildImplementationsFile();
  await rm(out, { recursive: true, force: true });
  await mkdir(out + 'privacy', { recursive: true });
  await mkdir(out + 'data');
  await writeFile(out + 'data/implementations.json', implementations.text);
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
