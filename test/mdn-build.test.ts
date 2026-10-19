import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BuildInputs } from '../scripts/bcd.ts';
import { buildMdnFile, MDN_CONTENT, parseFrontMatter, type Run } from '../scripts/mdn.ts';
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
  bcd: { api: { Request: { __compat: { spec_url: 'https://fetch.spec.whatwg.org/#request-class' } } } },
  specs: [spec('fetch', 'https://fetch.spec.whatwg.org/'), spec('battery-status', 'https://w3c.github.io/battery/')],
};

const COMMIT = 'a'.repeat(40);
const fm = (title: string, slug: string, pageType: string, extra = '') =>
  `---\ntitle: ${title}\nslug: ${slug}\npage-type: ${pageType}\n${extra}\n---\n\nSome text.\n`;
const PAGES: Record<string, string> = {
  'files/en-us/web/api/request/index.md': fm('Request', 'Web/API/Request', 'web-api-interface', 'browser-compat: api.Request'),
  'files/en-us/web/api/battery_status_api/index.md': fm('Battery Status API', 'Web/API/Battery_Status_API', 'web-api-overview', 'spec-urls: https://w3c.github.io/battery/'),
  'files/en-us/web/api/unrelated/index.md': fm('Unrelated', 'Web/API/Unrelated', 'web-api-interface'),
};

// Fakes git: A clone writes the pages into its target directory, and "git log" prints the given line.
function fakeGit(pages: Record<string, string> = PAGES, log = `${COMMIT} 2026-10-18\n`) {
  const calls: string[][] = [];
  const run: Run = async (args) => {
    calls.push(args);
    if (args[0] === 'clone') {
      const dir = args[args.length - 1];
      for (const [path, text] of Object.entries(pages)) {
        await mkdir(dirname(join(dir, path)), { recursive: true });
        await writeFile(join(dir, path), text);
      }
    }
    return args.includes('log') ? log : '';
  };
  return { calls, run };
}

describe('parseFrontMatter', () => {
  it('reads scalar, quoted, and list values, and ignores every other line', () => {
    const text = [
      '---',
      'title: "Request: body property"',
      'short-title: body',
      'slug: Web/API/Request/body',
      'page-type: web-api-instance-property',
      'status:',
      '  - experimental',
      'browser-compat: api.Request.body',
      'spec-urls:',
      '  - https://fetch.spec.whatwg.org/#dom-body-body',
      "  - 'https://example.test/b'",
      'sidebar: apiref("Fetch API")',
      '---',
      '',
      'The body.',
    ].join('\n');
    expect(parseFrontMatter(text, 'x/index.md')).toEqual({
      title: 'Request: body property',
      slug: 'Web/API/Request/body',
      pageType: 'web-api-instance-property',
      specUrls: ['https://fetch.spec.whatwg.org/#dom-body-body', 'https://example.test/b'],
      browserCompat: ['api.Request.body'],
    });
  });

  it("undoes YAML's quoting in titles", () => {
    expect(parseFrontMatter('---\ntitle: "Backreference: \\\\1, \\\\2"\nslug: a\n---\n', 'f').title).toBe('Backreference: \\1, \\2');
    expect(parseFrontMatter('---\ntitle: "say \\"hi\\""\nslug: a\n---\n', 'f').title).toBe('say "hi"');
    expect(parseFrontMatter("---\ntitle: 'can''t be deleted'\nslug: a\n---\n", 'f').title).toBe("can't be deleted");
  });

  it('throws for a page with no front matter, or with no title or slug', () => {
    expect(() => parseFrontMatter('# A page', 'files/en-us/a/index.md')).toThrow('files/en-us/a/index.md has no front matter');
    expect(() => parseFrontMatter('---\nslug: a\n---\n', 'f')).toThrow('f has no title in its front matter');
    expect(() => parseFrontMatter('---\ntitle: A\n---\n', 'f')).toThrow('f has no slug in its front matter');
  });
});

describe('buildMdnFile', () => {
  it('clones mdn/content sparsely, and builds the file from its pages and BCD', async () => {
    const git = fakeGit();
    const { url, text } = await buildMdnFile(inputs, git.run, 2);
    expect(url).toBe(`${MDN_CONTENT}/tree/${COMMIT}`);
    expect(git.calls[0].slice(0, 6)).toEqual(['clone', '--depth', '1', '--filter=blob:none', '--sparse', MDN_CONTENT]);
    expect(git.calls[1].slice(2)).toEqual(['sparse-checkout', 'set', '--no-cone', '/files/en-us/**/index.md']);
    expect(git.calls[2].slice(2)).toEqual(['log', '-1', '--format=%H %cs']);
    const file = JSON.parse(text);
    expect(file.content).toEqual({ commit: COMMIT, date: '2026-10-18' });
    expect(file.pages.map((p: unknown[]) => p[0])).toEqual(['Web/API/Battery_Status_API', 'Web/API/Request']);
    expect(Object.keys(file.specs)).toEqual(['battery-status', 'fetch']);
  });

  it('removes the clone afterward, even when the build fails', async () => {
    const ok = fakeGit();
    await buildMdnFile(inputs, ok.run, 2);
    expect(existsSync(dirname(ok.calls[0][6]))).toBe(false);
    const failing = fakeGit();
    await expect(buildMdnFile(inputs, failing.run, 3)).rejects.toThrow();
    expect(existsSync(dirname(failing.calls[0][6]))).toBe(false);
  });

  it('throws when fewer specs get articles than the floor', async () => {
    await expect(buildMdnFile(inputs, fakeGit().run, 3)).rejects.toThrow('mdn/content aaaaaaa gave articles for only 2 specs, fewer than 3');
  });

  it('throws when the clone fails', async () => {
    const run: Run = async () => {
      throw new Error('could not resolve host');
    };
    await expect(buildMdnFile(inputs, run, 1)).rejects.toThrow(`cloning ${MDN_CONTENT} failed: could not resolve host`);
  });

  it("throws when git log doesn't print a commit and its date", async () => {
    await expect(buildMdnFile(inputs, fakeGit(PAGES, 'fatal: bad\n').run, 1)).rejects.toThrow('git log printed "fatal: bad"');
  });

  it('throws, naming the page, when a page has no front matter', async () => {
    const git = fakeGit({ ...PAGES, 'files/en-us/web/api/x/index.md': '# No front matter\n' });
    await expect(buildMdnFile(inputs, git.run, 1)).rejects.toThrow('files/en-us/web/api/x/index.md has no front matter');
  });
});
