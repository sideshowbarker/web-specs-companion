import { describe, it, expect } from 'vitest';
import { fillManifest } from '../scripts/build.ts';

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
