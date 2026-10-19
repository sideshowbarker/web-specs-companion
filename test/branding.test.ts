import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The names the extension went by as W3C Companion, which nothing in the repo may use: not in a file's path, and not
// in its text.
const OLD = ['W3C Companion', 'w3c-companion', 'w3c-oss', 'w3cc', 'w3c-symbol'];
const ROOTS = ['src', 'static', 'e2e', 'scripts/mdn.ts', 'scripts/screenshots.ts', 'test/usedby.test.ts', 'test/links.test.ts', 'package.json'];
const SELF = 'test/branding.test.ts';

const files = (path: string): string[] =>
  statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => files(join(path, name))) : [path];
const read = (path: string) => readFileSync(path, 'utf8');
const json = (path: string) => JSON.parse(read(path));

describe('the rebrand', () => {
  it('leaves none of the old names', () => {
    const hits = ROOTS.flatMap(files).filter((f) => f !== SELF).flatMap((f) => {
      const text = /[.](png|jpg)$/.test(f) ? '' : read(f);
      return OLD.filter((old) => f.includes(old) || text.includes(old)).map((old) => `${f}: ${old}`);
    });
    expect(hits).toEqual([]);
  });

  it('names the extension Web Specs Companion, with its own Firefox ID and keyword', () => {
    const manifest = json('static/manifest.json');
    expect(manifest.browser_specific_settings.gecko.id).toBe('web-specs-companion@sideshowbarker.net');
    expect(manifest.omnibox.keyword).toBe('spec');
    const m = json('static/_locales/en/messages.json');
    expect([m.extName.message, m.extShortName.message, m.actionTitle.message]).toEqual(['Web Specs Companion', 'Web Specs', 'Web Specs Companion']);
    expect(m.extDescription.message).toBe('A companion for reading web specs and finding the groups and people behind them.');
    expect(m.extDescription.message.length).toBeLessThanOrEqual(132);
  });

  it('names the npm package web-specs-companion', () => {
    const pkg = json('package.json');
    const lock = json('package-lock.json');
    expect([pkg.name, pkg.repository, lock.name, lock.packages[''].name]).toEqual(
      ['web-specs-companion', 'github:sideshowbarker/web-specs-companion', 'web-specs-companion', 'web-specs-companion']);
  });
});
