import type { SpecRef } from '../shared/types.ts';
import type { Http } from './http.ts';
import { HOUR, URLS } from './urls.ts';

export interface WebrefEntry {
  shortname: string;
  date?: string;
  revision?: string;
  backrefs?: string;
  links?: string;
  refs?: string;
  idlparsed?: string;
  ids?: string;
  dfns?: string;
}

export interface Backref {
  id: string;
  href: string;
  linkingText: string[];
  type: string;
  for: string[];
  access: string;
  referencedBy: SpecRef[];
}

export interface Dfn {
  id: string;
  href: string;
  linkingText: string[];
  type: string;
  for: string[];
  access: string;
}

export type LinkGroup = Record<string, { anchors?: string[] }>;

export interface Extracts {
  backrefs: { backrefs: Backref[] };
  links: { links: { rawlinks: LinkGroup; autolinks: LinkGroup } };
  refs: { refs: { normative: { name: string; url: string }[]; informative: { name: string; url: string }[] } };
  idlparsed: { idlparsed: { idlNames: Record<string, unknown>; idlExtendedNames: Record<string, unknown> } };
  ids: { ids: string[] };
  dfns: { dfns: Dfn[] };
}

export interface WebrefIndex {
  date?: string;
  entries: Map<string, WebrefEntry>;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Turns the date a spec shows, as webref records it ("02 February 2026"), into an ISO date (2026-02-02).
export function isoFromSpecDate(date: string | undefined): string | undefined {
  const m = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(date ?? '');
  const month = m ? MONTHS.indexOf(m[2]) + 1 : 0;
  return m && month ? `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
}

const TTL = 6 * HOUR;
let memo: { at: number; index: WebrefIndex } | undefined;

export async function getWebrefIndex(http: Http, now: () => number = Date.now): Promise<WebrefIndex> {
  if (memo && now() - memo.at < TTL) return memo.index;
  const raw = await http.json<{ date?: string; results?: WebrefEntry[] }>(`${URLS.webref}index.json`, { ttlMs: TTL });
  const index = { date: raw?.date, entries: new Map((raw?.results ?? []).map((e) => [e.shortname, e])) };
  memo = { at: now(), index };
  return index;
}

export async function getExtract<K extends keyof Extracts>(http: Http, entry: WebrefEntry | undefined, key: K): Promise<Extracts[K] | undefined> {
  const path = entry?.[key as keyof WebrefEntry];
  if (typeof path !== 'string') return undefined;
  return http.json<Extracts[K]>(`${URLS.webref}${path}`, { ttlMs: TTL });
}
