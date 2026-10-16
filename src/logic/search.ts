import { groupPageUrl } from '../data/groups.ts';
import type { Http } from '../data/http.ts';
import type { SpecIndex } from '../data/specs.ts';
import { DAY, URLS } from '../data/urls.ts';
import type { IdlNames, SlimGroup, SlimSpec } from '../shared/types.ts';
import { statusCode } from './maturity.ts';

export interface SearchItem {
  kind: 'spec' | 'group' | 'idl' | 'term';
  label: string;
  detail: string;
  url: string;
  keys: string[];
  boost: number;
  idlName?: string;
}

export type Scope = 'all' | 'group' | 'idl' | 'term';

const DOT = ' · ';
export const IDL_TYPES = ['interface', 'dictionary', 'enum', 'typedef', 'callback', 'namespace'];

export function webidlpediaUrl(name: string): string {
  return `https://dontcallmedom.github.io/webidlpedia/names/${encodeURIComponent(name)}.html`;
}

export function parseQuery(q: string): { scope: Scope; text: string; groupType?: string } {
  const t = q.trim().replace(/\s+/g, ' ');
  const m = /^(wg|ig|cg|bg|tf|group|idl|dfn|term) (.+)$/i.exec(t);
  if (!m) return { scope: 'all', text: t };
  const k = m[1].toLowerCase();
  if (k === 'idl') return { scope: 'idl', text: m[2] };
  if (k === 'dfn' || k === 'term') return { scope: 'term', text: m[2] };
  return { scope: 'group', text: m[2], groupType: k === 'group' ? undefined : k };
}

export function buildSearchItems(specs: SlimSpec[], groups: SlimGroup[], idl: IdlNames): SearchItem[] {
  const items: SearchItem[] = [];
  for (const s of specs) {
    const code = statusCode(s.release?.status ?? s.nightly?.status);
    items.push({
      kind: 'spec',
      label: s.title,
      detail: [s.shortname, code].filter(Boolean).join(DOT),
      url: s.url,
      keys: [s.shortname, s.series.shortname, s.title, s.shortTitle ?? ''].filter(Boolean),
      boost: (s.series.currentSpecification === s.shortname ? 4 : 0) + (s.standing === 'good' ? 2 : 0),
    });
  }
  for (const g of groups) {
    items.push({
      kind: 'group',
      label: g.name,
      detail: g.identifier,
      url: groupPageUrl(g),
      keys: [g.identifier, g.identifier.split('/')[1], g.name],
      boost: g.type === 'working group' ? 3 : 0,
    });
  }
  for (const [name, v] of Object.entries(idl)) {
    items.push({ kind: 'idl', label: name, detail: `${v.type} (Web IDL)`, url: webidlpediaUrl(name), keys: [name], boost: 1, idlName: name });
  }
  return items;
}

function scoreKey(key: string, t: string, words: string[]): number {
  const k = key.toLowerCase();
  if (k === t) return 100;
  if (k.startsWith(t)) return 70 - Math.min(20, k.length - t.length);
  const kw = k.split(/[\s\-/().,]+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => kw.some((x) => x.startsWith(w)))) return 55;
  if (kw.some((x) => x.startsWith(t))) return 45;
  if (k.includes(t)) return 25;
  return 0;
}

export function search(items: SearchItem[], query: string, limit = 8): SearchItem[] {
  const { scope, text, groupType } = parseQuery(query);
  const t = text.toLowerCase();
  if (!t || scope === 'term') return [];
  const words = t.split(' ');
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    if (scope === 'group' && (item.kind !== 'group' || (groupType && !item.detail.startsWith(`${groupType}/`)))) continue;
    if (scope === 'idl' && item.kind !== 'idl') continue;
    let best = 0;
    for (const k of item.keys) best = Math.max(best, scoreKey(k, t, words));
    if (best) scored.push({ item, score: best + item.boost });
  }
  scored.sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length);
  return scored.slice(0, limit).map((s) => s.item);
}

interface XrefHit {
  shortname: string;
  type: string;
  for?: string[];
  uri: string;
}

export async function termSearch(http: Http, specs: SpecIndex, term: string, types?: string[]): Promise<SearchItem[]> {
  const query: Record<string, unknown> = { term };
  if (types) query.types = types;
  // Never send an id: The xref service keys its cache on query ids and would answer with another query's results.
  const body = JSON.stringify({ queries: [query], options: { fields: ['shortname', 'type', 'for', 'uri'] } });
  const res = await http.json<{ results?: { result?: XrefHit[] }[] }>(URLS.xref, {
    ttlMs: DAY,
    key: `xref:${body}`,
    init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
  });
  const out: SearchItem[] = [];
  for (const h of res?.results?.[0]?.result ?? []) {
    const spec = specs.get(h.shortname);
    if (!spec) continue;
    let url: string;
    try {
      url = new URL(h.uri, spec.nightly?.url ?? spec.url).href;
    } catch {
      continue;
    }
    const scope = h.for?.length ? ` of ${h.for.join(', ')}` : '';
    out.push({ kind: 'term', label: term, detail: `${h.type}${scope}${DOT}${spec.title}`, url, keys: [term], boost: 0 });
  }
  return out;
}
