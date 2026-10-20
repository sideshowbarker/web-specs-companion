import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixProject } from '../scripts/mac-app.ts';

// The project that Safari's packager generates with --macos-only, unedited.
const generated = readFileSync('test/fixtures/safari-macos.pbxproj', 'utf8');
const options = { bundleId: 'net.sideshowbarker.WebSpecsCompanion', version: '1.1.0', build: 3 };

// Every value that a build setting takes in the project, in order.
const values = (project: string, key: string) =>
  [...project.matchAll(new RegExp(`${key} = ([^;]+);`, 'g'))].map((m) => m[1]);

describe('fixProject', () => {
  it("gives the app the bundle ID that its extension's ID starts with", () => {
    expect(values(generated, 'PRODUCT_BUNDLE_IDENTIFIER')).toContain('"net.sideshowbarker.Web-Specs-Companion"');
    expect(values(fixProject(generated, options), 'PRODUCT_BUNDLE_IDENTIFIER')).toEqual([
      'net.sideshowbarker.WebSpecsCompanion.Extension',
      'net.sideshowbarker.WebSpecsCompanion.Extension',
      'net.sideshowbarker.WebSpecsCompanion',
      'net.sideshowbarker.WebSpecsCompanion',
    ]);
  });

  it('sets the version and the build number in every configuration', () => {
    const fixed = fixProject(generated, options);
    expect(values(fixed, 'MARKETING_VERSION')).toEqual(['1.1.0', '1.1.0', '1.1.0', '1.1.0']);
    expect(values(fixed, 'CURRENT_PROJECT_VERSION')).toEqual(['3', '3', '3', '3']);
  });

  it('puts the app, and not its extension, in the Developer Tools category', () => {
    const blocks = fixProject(generated, options).split('buildSettings = {').slice(1);
    const categories = blocks.map((block) => [
      values(block, 'PRODUCT_BUNDLE_IDENTIFIER')[0],
      values(block, 'INFOPLIST_KEY_LSApplicationCategoryType')[0],
    ]);
    expect(categories).toEqual([
      [undefined, undefined],
      [undefined, undefined],
      ['net.sideshowbarker.WebSpecsCompanion.Extension', undefined],
      ['net.sideshowbarker.WebSpecsCompanion.Extension', undefined],
      ['net.sideshowbarker.WebSpecsCompanion', '"public.app-category.developer-tools"'],
      ['net.sideshowbarker.WebSpecsCompanion', '"public.app-category.developer-tools"'],
    ]);
  });

  it('changes nothing more when it runs again', () => {
    const fixed = fixProject(generated, options);
    expect(fixProject(fixed, options)).toBe(fixed);
  });

  it("throws when the extension's bundle ID isn't the app's with .Extension added", () => {
    expect(() => fixProject(generated, { ...options, bundleId: 'net.example.Other' })).toThrow(
      'no extension with the bundle ID net.example.Other.Extension',
    );
  });
});
