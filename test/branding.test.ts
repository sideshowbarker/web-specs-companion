import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// The names the extension went by as W3C Companion, which nothing in the repo may use: not in a file's path, and not
// in its text. Only the files git tracks count, so an editor's backup and undo files don't.
const OLD = ['W3C Companion', 'w3c-companion', 'w3c-oss', 'w3cc', 'w3c-symbol'];
const ROOTS = ['src', 'static', 'e2e', 'scripts', 'test', 'site', 'store', '.github', 'assets', 'README.md', 'package.json'];
const SELF = 'test/branding.test.ts';

const tracked = (roots: string[]) =>
  execFileSync('git', ['ls-files', '-z', '--', ...roots], { encoding: 'utf8' }).split('\0').filter(Boolean);
const read = (path: string) => readFileSync(path, 'utf8');
const json = (path: string) => JSON.parse(read(path));

describe('the rebrand', () => {
  it('leaves none of the old names', () => {
    const hits = tracked(ROOTS).filter((f) => f !== SELF).flatMap((f) => {
      const text = /[.](png|jpg)$/.test(f) ? '' : read(f);
      return OLD.filter((old) => f.includes(old) || text.includes(old)).map((old) => `${f}: ${old}`);
    });
    expect(hits).toEqual([]);
  });

  it('names the extension Browser specs companion, with its own Firefox ID and keyword', () => {
    const manifest = json('static/manifest.json');
    expect(manifest.browser_specific_settings.gecko.id).toBe('web-specs-companion@sideshowbarker.net');
    expect(manifest.omnibox.keyword).toBe('spec');
    const m = json('static/_locales/en/messages.json');
    expect([m.extName.message, m.extShortName.message, m.actionTitle.message]).toEqual(['Browser specs companion', 'Browser specs', 'Browser specs companion']);
    expect(m.extDescription.message).toBe('A companion for reading web specs and finding the groups and people behind them.');
    expect(m.extDescription.message.length).toBeLessThanOrEqual(132);
  });

  it('names the npm package web-specs-companion', () => {
    const pkg = json('package.json');
    const lock = json('package-lock.json');
    expect([pkg.name, pkg.repository, lock.name, lock.packages[''].name]).toEqual(
      ['web-specs-companion', 'github:sideshowbarker/web-specs-companion', 'web-specs-companion', 'web-specs-companion']);
  });

  it('drops the W3C Open Source Program files', () => {
    expect(['GOVERNANCE.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'CODEOWNERS'].filter((f) => existsSync(f))).toEqual([]);
  });

  it('gives both stores the same summary and description', () => {
    const listing = read('store/listing.md');
    const field = (name: string) => listing.split(`**${name}:**`)[1].split('\n\n**')[0].trim();
    const amo = json('store/amo-metadata.json');
    const summary = json('static/_locales/en/messages.json').extDescription.message;
    expect([field('Summary (132 characters max)'), amo.summary['en-US']]).toEqual([summary, summary]);
    expect(field('Description')).toBe(amo.description['en-US']);
  });
});
