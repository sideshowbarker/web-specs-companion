// Lists, for each spec in browser-specs, the MDN pages that document it, from the front matter of MDN's pages in
// mdn/content and from MDN's browser-compat-data (BCD).
import type { SlimSpec } from '../shared/types.ts';
import { compatSpecs, forEachFeature, matchSpecUrl, specUrlIndex } from './implementations.ts';

// The fields the build reads from a page's front matter.
export interface FrontMatter {
  title: string;
  slug: string; // e.g. 'Web/API/Request'
  pageType?: string; // e.g. 'web-api-interface'
  specUrls: string[];
  browserCompat: string[]; // BCD keys, e.g. 'api.Request'
}

// [slug, title, index into MdnFile.types]
export type MdnPage = [string, string, number];

export interface MdnFile {
  content: { commit: string; date: string }; // mdn/content's commit, and its committer date as YYYY-MM-DD
  types: string[]; // the page types the pages use, sorted, with '' for a page that has none
  pages: MdnPage[]; // every page some spec lists, sorted by slug
  specs: Record<string, number[]>; // by browser-specs shortname: Indexes into pages, ascending
}

// MDN serves a page at this prefix and its slug, in the reader's language.
export const MDN_DOCS = 'https://developer.mozilla.org/docs/';

// MDN's pages about itself and its learning area, which document no spec.
function leftOut(page: FrontMatter): boolean {
  return /^(mdn|learn)-/.test(page.pageType ?? '') || page.slug.startsWith('MDN/');
}

function addAll(map: Map<string, Set<string>>, key: string, values: Iterable<string>) {
  const set = map.get(key) ?? new Set<string>();
  for (const v of values) set.add(v);
  map.set(key, set);
}

// Builds the MDN file. A page belongs to a spec when one of its spec-urls matches the spec, when one of its
// browser-compat keys is a BCD feature whose own spec_url matches it, or when the mdn_url of such a feature names the
// page. A feature with no spec_url of its own matches nothing, and an mdn_url that names no page lists nothing.
export function buildMdn(pages: FrontMatter[], bcd: unknown, specs: SlimSpec[], content: MdnFile['content']): MdnFile {
  const index = specUrlIndex(specs);
  const keySpecs = new Map<string, Set<string>>();
  const slugSpecs = new Map<string, Set<string>>();
  forEachFeature(bcd, (key, compat) => {
    const matched = compatSpecs(compat, index);
    if (matched.size === 0) return;
    keySpecs.set(key, matched);
    if (typeof compat.mdn_url === 'string' && compat.mdn_url.startsWith(MDN_DOCS)) {
      addAll(slugSpecs, compat.mdn_url.slice(MDN_DOCS.length), matched);
    }
  });
  const listed = new Map<string, FrontMatter>();
  const bySpec = new Map<string, Set<string>>();
  for (const page of pages) {
    if (leftOut(page) || listed.has(page.slug)) continue;
    const matched = new Set<string>(slugSpecs.get(page.slug));
    for (const url of page.specUrls) {
      const shortname = matchSpecUrl(index, url);
      if (shortname) matched.add(shortname);
    }
    for (const key of page.browserCompat) for (const shortname of keySpecs.get(key) ?? []) matched.add(shortname);
    if (matched.size === 0) continue;
    listed.set(page.slug, page);
    for (const shortname of matched) addAll(bySpec, shortname, [page.slug]);
  }
  const slugs = [...listed.keys()].sort();
  const types = [...new Set(slugs.map((slug) => listed.get(slug)!.pageType ?? ''))].sort();
  const at = new Map(slugs.map((slug, i) => [slug, i]));
  const out: Record<string, number[]> = {};
  for (const shortname of [...bySpec.keys()].sort()) {
    out[shortname] = [...bySpec.get(shortname)!].map((slug) => at.get(slug)!).sort((a, b) => a - b);
  }
  const entry = (slug: string): MdnPage => [slug, listed.get(slug)!.title, types.indexOf(listed.get(slug)!.pageType ?? '')];
  return { content, types, pages: slugs.map(entry), specs: out };
}
