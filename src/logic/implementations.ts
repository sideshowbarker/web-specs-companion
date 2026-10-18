// Works out, from MDN's browser-compat-data (BCD), which of the three browser engines implement each spec in
// browser-specs. BCD describes features one at a time, each with the URLs of the spec sections that define it, so a
// spec's verdict comes from the features whose spec URLs fall within it.
import type { SlimSpec } from '../shared/types.ts';

export type Engine = 'gecko' | 'webkit' | 'blink';
export const ENGINES: readonly Engine[] = ['gecko', 'webkit', 'blink'];

// Every other BCD browser is ignored: The Chromium-based ones are Blink, which Chrome already counts.
const BROWSERS: Record<Engine, readonly string[]> = {
  gecko: ['firefox', 'firefox_android'],
  webkit: ['safari', 'safari_ios'],
  blink: ['chrome', 'chrome_android'],
};

// Drops the scheme and any leading www., the query and fragment, an index or Overview page, and trailing slashes.
export function normalizeUrl(url: string): string {
  return url
    .split('#')[0]
    .split('?')[0]
    .replace(/^https?:[/][/](www[.])?/, '')
    .replace(/(index[.]html?|Overview[.]html)$/, '')
    .replace(/[/]+$/, '');
}

// Maps each normalized URL a spec can be cited by to the spec's shortname: its own URLs and multipage pages, and then
// its series' URLs, which stand for the series' current level. A URL keeps its first claimant, so a spec's own URLs
// win over series URLs, and among specs, the first in browser-specs' order wins.
export function specUrlIndex(specs: SlimSpec[]): Map<string, string> {
  const index = new Map<string, string>();
  const claim = (url: string | undefined, shortname: string) => {
    const key = url ? normalizeUrl(url) : '';
    if (key && !index.has(key)) index.set(key, shortname);
  };
  for (const s of specs) {
    for (const url of [s.url, s.nightly?.url, ...(s.nightly?.alternateUrls ?? []), ...(s.nightly?.pages ?? []), s.release?.url]) {
      claim(url, s.shortname);
    }
  }
  for (const s of specs) {
    claim(s.series.nightlyUrl, s.series.currentSpecification);
    claim(s.series.releaseUrl, s.series.currentSpecification);
  }
  return index;
}

// Matches a spec URL to the longest indexed URL that it equals, or that it starts with followed by a slash.
export function matchSpecUrl(index: Map<string, string>, url: string): string | undefined {
  for (let key = normalizeUrl(url); key; key = key.slice(0, Math.max(key.lastIndexOf('/'), 0))) {
    const shortname = index.get(key);
    if (shortname) return shortname;
  }
  return undefined;
}

interface Statement {
  version_added?: unknown;
  version_removed?: unknown;
  flags?: unknown;
}

// An engine ships a feature when a support statement for one of its browsers records a release (not a preview), with
// no removal and no flag. Prefixed, alternative-name, and partial support count, since BCD treats them as shipped.
export function ships(support: Record<string, unknown> | undefined, engine: Engine): boolean {
  return BROWSERS[engine].some((browser) =>
    ([] as unknown[]).concat(support?.[browser] ?? []).some((s) => {
      if (!s || typeof s !== 'object') return false;
      const { version_added: added, version_removed: removed, flags } = s as Statement;
      const released = added === true || (typeof added === 'string' && added !== '' && added !== 'preview');
      const flagged = Array.isArray(flags) ? flags.length > 0 : Boolean(flags);
      return released && !removed && !flagged;
    }),
  );
}
