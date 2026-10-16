// Bundles the extension into dist/. One manifest serves every browser: Each engine ignores the keys it doesn't define.
// https://w3c.github.io/webextensions/specification/#manifest-keys
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = root + 'dist/';

type ContentScript = { js: string[]; include_globs?: string[] };
type Manifest = { version: string; content_scripts: ContentScript[] };

export function fillManifest(template: object, version: string, owners: string[]): object {
  const manifest = structuredClone(template) as Manifest;
  manifest.version = version;
  const github = manifest.content_scripts.find((cs) => cs.js.includes('github.js'));
  if (!github) throw new Error('manifest template has no github.js content script');
  // Globs narrow the github.com match to the owners that host W3C repos:
  // https://w3c.github.io/webextensions/specification/#key-include_globs
  github.include_globs = [...new Set(owners)].map((owner) => `https://github.com/${owner}/*`);
  return manifest;
}

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  const common = {
    bundle: true,
    format: 'iife' as const,
    minify: false,
    sourcemap: false,
    target: ['chrome148', 'firefox128', 'safari18'],
    jsx: 'automatic' as const,
    jsxImportSource: 'preact',
    logLevel: 'info' as const,
  };
  const entries: Record<string, string> = {
    background: 'src/background/index.ts',
    spec: 'src/content/spec.ts',
    'respec-main': 'src/content/respec-main.ts',
    github: 'src/content/github.ts',
    panel: 'src/ui/main.tsx',
  };
  for (const [name, entry] of Object.entries(entries)) {
    await build({ ...common, entryPoints: [root + entry], outfile: `${dist}${name}.js` });
  }
  for (const item of ['popup.html', 'sidepanel.html', 'panel.css', '_locales', 'icons']) {
    await cp(root + 'static/' + item, dist + item, { recursive: true });
  }
  await cp(root + 'data', dist + 'data', { recursive: true });
  const pkg = JSON.parse(await readFile(root + 'package.json', 'utf8'));
  const template = JSON.parse(await readFile(root + 'static/manifest.json', 'utf8'));
  const repoMap = JSON.parse(await readFile(root + 'data/repos.json', 'utf8')) as { owners: Record<string, string> };
  const owners = Object.values(repoMap.owners);
  await writeFile(dist + 'manifest.json', JSON.stringify(fillManifest(template, pkg.version, owners), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
