import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fillTemplate, probeStores, renderMarkdown, type Fetch } from '../scripts/site.ts';

const read = (path: string) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const section = (html: string, id: string) => html.match(new RegExp(`<section[^>]* id="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
const every = [
  { amo: false, cws: false },
  { amo: true, cws: false },
  { amo: false, cws: true },
  { amo: true, cws: true },
];

describe('fillTemplate', () => {
  const page = 'v{{version}} <!-- if amo -->A<!-- endif --><!-- if !amo -->a<!-- endif --> '
    + '<!-- if cws -->C<!-- endif --><!-- if !cws -->c<!-- endif -->';

  it('fills the placeholders, and keeps only the blocks that match the stores', () => {
    expect(fillTemplate(page, { version: '1.2.3' }, { amo: true, cws: false })).toBe('v1.2.3 A c');
    expect(fillTemplate(page, { version: '1.2.3' }, { amo: false, cws: true })).toBe('v1.2.3 a C');
  });

  it('throws on a placeholder it has no value for', () => {
    expect(() => fillTemplate('{{zip}}', { version: '1' }, every[0])).toThrow(/\{\{zip\}\}/);
  });

  it('throws on a block it can\'t resolve', () => {
    expect(() => fillTemplate('<!-- if edge -->x<!-- endif -->', {}, every[0])).toThrow(/edge/);
    expect(() => fillTemplate('<!-- if amo --><!-- if cws -->x<!-- endif --><!-- endif -->', {}, every[0])).toThrow();
  });
});

describe('probeStores', () => {
  const amoApi = 'https://addons.mozilla.org/api/v5/addons/addon/web-specs-companion/';
  const cwsPage = 'https://chromewebstore.google.com/detail/hpajpmapkffhaiggemaeajpkehfnapkm';
  const fake = (amo: { status: number; body?: object }, cws: { status: number; title?: string }): Fetch =>
    async (url) => {
      const answer = url === amoApi ? amo : url === cwsPage ? cws : { status: 599 };
      const body = 'body' in answer ? JSON.stringify(answer.body) : `<title>${'title' in answer ? answer.title : ''}</title>`;
      return new Response(body, { status: answer.status });
    };

  it('counts Firefox Add-ons as listing the extension once its listing is public', async () => {
    const cws = { status: 200, title: 'Chrome Web Store' };
    expect((await probeStores(fake({ status: 200, body: { status: 'public' } }, cws))).amo).toBe(true);
    expect((await probeStores(fake({ status: 401, body: { detail: 'Authentication credentials were not provided.' } }, cws))).amo).toBe(false);
    expect((await probeStores(fake({ status: 404, body: {} }, cws))).amo).toBe(false);
  });

  it('counts the Chrome Web Store as listing the extension once its item page has its name', async () => {
    const amo = { status: 401, body: {} };
    expect((await probeStores(fake(amo, { status: 200, title: 'Web Specs Companion - Chrome Web Store' }))).cws).toBe(true);
    expect((await probeStores(fake(amo, { status: 200, title: 'Chrome Web Store' }))).cws).toBe(false);
    expect((await probeStores(fake(amo, { status: 404 }))).cws).toBe(false);
  });

  it('throws when a store answers with any other error', async () => {
    await expect(probeStores(fake({ status: 503, body: {} }, { status: 200 }))).rejects.toThrow(/Firefox Add-ons.*503/);
    await expect(probeStores(fake({ status: 401, body: {} }, { status: 500 }))).rejects.toThrow(/Chrome Web Store.*500/);
  });
});

describe('renderMarkdown', () => {
  it('renders the privacy policy', async () => {
    const html = renderMarkdown(await read('store/privacy.md'));
    expect(html).toMatch(/<h1[^>]*>Privacy<\/h1>/);
    expect(html.match(/<li>/g)).toHaveLength(4);
  });
});

describe('the site', () => {
  const values = { version: '1.2.3', zip: 'https://example.test/web-specs-companion-1.2.3.zip' };

  it('disclaims any formal affiliation, and claims no W3C copyright or trademark', async () => {
    const page = fillTemplate(await read('site/index.html'), values, every[0]);
    expect(page).toContain(
      '<p class="disclaimer">Web Specs Companion isn\u2019t formally affiliated with or endorsed by W3C, WHATWG, or any ' +
        'other standards body.</p>',
    );
    expect(page).not.toMatch(/World Wide Web Consortium|trademark/);
  });

  it('builds for every combination of stores, with nothing left unfilled', async () => {
    const page = await read('site/index.html');
    for (const stores of every) {
      expect(fillTemplate(page, values, stores)).not.toMatch(/\{\{|<!-- (if|endif)\b/);
    }
  });

  it('sends each browser to its store once the store lists the extension, and to the zip until then', async () => {
    const page = await read('site/index.html');
    const before = fillTemplate(page, values, every[0]);
    const after = fillTemplate(page, values, every[3]);
    expect(section(before, 'chrome')).toContain(values.zip);
    expect(section(before, 'chrome')).not.toContain('chromewebstore.google.com');
    expect(section(after, 'chrome')).toContain('https://chromewebstore.google.com/detail/hpajpmapkffhaiggemaeajpkehfnapkm');
    expect(section(after, 'chrome')).not.toContain(values.zip);
    expect(section(before, 'firefox')).toContain(values.zip);
    expect(section(before, 'firefox')).not.toContain('addons.mozilla.org');
    expect(section(after, 'firefox')).toContain('https://addons.mozilla.org/firefox/addon/web-specs-companion/');
    expect(section(after, 'firefox')).not.toContain(values.zip);
    expect(section(after, 'safari')).toContain(values.zip);
  });

  it('shows every screenshot, and only screenshots that exist', async () => {
    const page = await read('site/index.html');
    const shown = [...page.matchAll(/src="screenshots\/([^"]+)"/g)].map((m) => m[1]).sort();
    const files = (await readdir(new URL('../screenshots/', import.meta.url))).filter((f) => f.endsWith('.png')).sort();
    expect(shown).toEqual(files);
  });

  it('fills the privacy page', async () => {
    const page = fillTemplate(await read('site/privacy.html'), { content: '<p>policy</p>' }, every[0]);
    expect(page).toContain('<p>policy</p>');
  });
});
