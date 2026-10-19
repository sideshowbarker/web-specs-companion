// Builds mdn.json: The MDN articles that document each spec in browser-specs, from the front matter of MDN's pages in
// mdn/content, and from BCD. It clones mdn/content blobless and sparse into a temporary directory, checking out only
// the pages' index.md files, and removes the clone afterward.
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { buildMdn, type FrontMatter, type MdnFile } from '../src/logic/mdn.ts';
import type { BuildInputs } from './bcd.ts';

export const MDN_CONTENT = 'https://github.com/mdn/content';

// About 430 specs get articles, so far fewer means MDN's front matter, or BCD's spec URLs, have changed shape.
export const MIN_MDN_SPECS = 300;

// Runs git with the given arguments, and resolves to what it printed.
export type Run = (args: string[]) => Promise<string>;

const git: Run = async (args) => (await promisify(execFile)('git', args, { maxBuffer: 16 * 1024 * 1024 })).stdout;

// Undoes YAML's quoting: A double-quoted value escapes a backslash or a double quote with a backslash, and a
// single-quoted one doubles a single quote.
function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\(["\\])/g, '$1');
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

// Reads the fields the build needs from a page's front matter, which writes them as "key: value" lines, quoted or not,
// or as a "key:" line followed by "  - item" lines. Every other line is ignored.
export function parseFrontMatter(text: string, file: string): FrontMatter {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!block) throw new Error(`${file} has no front matter`);
  const fields = new Map<string, string[]>();
  let list: string[] | undefined;
  for (const line of block[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      list?.push(unquote(item[1].trim()));
      continue;
    }
    const pair = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line);
    list = undefined;
    if (!pair) continue;
    const value = pair[2]?.trim() ?? '';
    if (value) fields.set(pair[1], [unquote(value)]);
    else fields.set(pair[1], (list = []));
  }
  const title = fields.get('title')?.[0];
  const slug = fields.get('slug')?.[0];
  if (!title) throw new Error(`${file} has no title in its front matter`);
  if (!slug) throw new Error(`${file} has no slug in its front matter`);
  const pageType = fields.get('page-type')?.[0];
  return {
    title,
    slug,
    ...(pageType ? { pageType } : {}),
    specUrls: fields.get('spec-urls') ?? [],
    browserCompat: fields.get('browser-compat') ?? [],
  };
}

// Reads the front matter of every page in a clone, in path order, one page at a time, since there are about 14,700.
async function readPages(dir: string): Promise<FrontMatter[]> {
  const root = join(dir, 'files', 'en-us');
  const files = (await readdir(root, { recursive: true })).filter((f) => basename(f) === 'index.md').sort();
  const pages: FrontMatter[] = [];
  for (const f of files) pages.push(parseFrontMatter(await readFile(join(root, f), 'utf8'), `files/en-us/${f}`));
  return pages;
}

// Clones mdn/content into dir, checking out only the pages, and answers with its commit and that commit's date.
async function cloneContent(dir: string, run: Run): Promise<MdnFile['content']> {
  try {
    await run(['clone', '--depth', '1', '--filter=blob:none', '--sparse', MDN_CONTENT, dir]);
    await run(['-C', dir, 'sparse-checkout', 'set', '--no-cone', '/files/en-us/**/index.md']);
    const log = (await run(['-C', dir, 'log', '-1', '--format=%H %cs'])).trim();
    const [, commit, date] = /^([0-9a-f]{40}) (\d{4}-\d{2}-\d{2})$/.exec(log) ?? [];
    if (!commit || !date) throw new Error(`git log printed "${log}"`);
    return { commit, date };
  } catch (err) {
    throw new Error(`cloning ${MDN_CONTENT} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function buildMdnFile(inputs: BuildInputs, run: Run = git, minSpecs = MIN_MDN_SPECS): Promise<{ url: string; text: string }> {
  const tmp = await mkdtemp(join(tmpdir(), 'wsc-mdn-'));
  try {
    const dir = join(tmp, 'content');
    const content = await cloneContent(dir, run);
    const file = buildMdn(await readPages(dir), inputs.bcd, inputs.specs, content);
    const count = Object.keys(file.specs).length;
    if (count < minSpecs) {
      throw new Error(`mdn/content ${content.commit.slice(0, 7)} gave articles for only ${count} specs, fewer than ${minSpecs}`);
    }
    return { url: `${MDN_CONTENT}/tree/${content.commit}`, text: JSON.stringify(file) };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
