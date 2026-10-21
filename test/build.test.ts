import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildExtension, fillManifest } from '../scripts/build.ts';

const template = {
  version: '0.0.0',
  content_scripts: [
    { matches: ['https://w3c.github.io/*'], js: ['respec-main.js'] },
    { matches: ['https://w3c.github.io/*'], js: ['spec.js'] },
    { matches: ['https://github.com/*'], include_globs: [], js: ['github.js'] },
  ],
};

describe('fillManifest', () => {
  it('sets the version and generates one include glob per GitHub owner', () => {
    const m = fillManifest(template, '1.2.3', ['w3c', 'WICG', 'w3c']) as typeof template;
    expect(m.version).toBe('1.2.3');
    expect(m.content_scripts[2].include_globs).toEqual([
      'https://github.com/w3c/*',
      'https://github.com/WICG/*',
    ]);
  });

  it('leaves the template object unmodified', () => {
    fillManifest(template, '1.2.3', ['w3c']);
    expect(template.version).toBe('0.0.0');
    expect(template.content_scripts[2].include_globs).toEqual([]);
  });

  it('throws when the template has no github.js content script', () => {
    expect(() => fillManifest({ version: '0', content_scripts: [] }, '1', ['w3c'])).toThrow(/github\.js/);
  });
});

// Safari's packager makes the Mac app's icon from the largest icon the manifest lists, so a 1024px one keeps it sharp.
describe('the manifest icons', () => {
  it('include a 1024px icon, and each is a PNG of the size it is listed at', () => {
    const icons = Object.entries(JSON.parse(readFileSync('static/manifest.json', 'utf8')).icons as Record<string, string>);
    expect(icons.map(([size]) => size)).toContain('1024');
    for (const [size, path] of icons) {
      const png = readFileSync(`static/${path}`);
      expect([path, png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([path, Number(size), Number(size)]);
    }
  });
});

describe('the comment command', () => {
  it('is declared with its suggested key and a localized description', () => {
    const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8'));
    expect(manifest.commands['comment-on-selection']).toEqual({ suggested_key: { default: 'Alt+Shift+C' }, description: '__MSG_commentCommand__' });
    expect(JSON.parse(readFileSync('static/_locales/en/messages.json', 'utf8')).commentCommand).toEqual({ message: 'Comment on the selected text' });
  });
});

describe('buildExtension', () => {
  it("leaves caniuse.com's icon out of the Mac app's build, and keeps it in every other", async () => {
    const out = await mkdtemp(join(tmpdir(), 'build-'));
    try {
      await buildExtension(join(out, 'mac'), { caniuseLogo: false });
      await buildExtension(join(out, 'all'), { caniuseLogo: true });
      expect(existsSync(join(out, 'mac/icons/caniuse.png'))).toBe(false);
      expect(existsSync(join(out, 'mac/icons/wpt.svg'))).toBe(true);
      expect(existsSync(join(out, 'all/icons/caniuse.png'))).toBe(true);
      for (const build of ['mac', 'all']) expect(readFileSync(join(out, build, 'panel.js'), 'utf8')).not.toContain('__CANIUSE_LOGO__');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
