import type { TpacView } from '../data/tpac.ts';
import type { GroupDetails, SpecDetails } from '../data/w3capi.ts';
import type { OutLink } from '../content/links.ts';
import type { Footprint, UsedByEntry } from '../logic/footprint.ts';
import type { LinkCheckResult } from '../logic/linkcheck.ts';
import type { Radar } from '../logic/radar.ts';
import type { SearchItem } from '../logic/search.ts';
import type { Context, PageFacts } from './types.ts';

export interface Api {
  'page-facts': { req: { facts: PageFacts }; res: { shortname?: string } };
  'get-context': { req: { tabId: number; url?: string }; res: { context: Context | null } };
  'get-spec-details': { req: { shortname: string }; res: { details: SpecDetails | null } };
  'get-group-details': { req: { identifier: string }; res: { details: GroupDetails | null } };
  'get-radar': { req: { tabId: number; url?: string }; res: { radar: Radar | null } };
  'get-tpac': { req: { groupNames?: string[] }; res: TpacView };
  'search': { req: { query: string }; res: { items: SearchItem[] } };
  'resolve-idl': { req: { name: string }; res: { url: string } };
  'get-footprint': { req: { shortname: string }; res: { footprint: Footprint | null } };
  'get-used-by': { req: { shortname: string }; res: { map: Record<string, UsedByEntry> | null; specdex: string } };
  'check-links': { req: { shortname: string; links: OutLink[] }; res: LinkCheckResult };
}

export type MessageType = keyof Api;
export type Message = { [K in MessageType]: { type: K } & Api[K]['req'] }[MessageType];

function unwrap<T>(res: unknown): T {
  if (res && typeof res === 'object' && 'error' in res) throw new Error(String((res as { error: unknown }).error));
  return res as T;
}

export async function send<K extends MessageType>(type: K, req: Api[K]['req']): Promise<Api[K]['res']> {
  return unwrap(await browser.runtime.sendMessage({ type, ...req }));
}

export interface TabApi {
  'run-link-check': { req: Record<string, never>; res: LinkCheckResult };
  'reveal-link': { req: { i: number }; res: { ok: boolean } };
  'clear-link-check': { req: Record<string, never>; res: { ok: boolean } };
}
export type TabMessage = { [K in keyof TabApi]: { type: K } & TabApi[K]['req'] }[keyof TabApi];

export async function sendToTab<K extends keyof TabApi>(
  tabId: number,
  type: K,
  req: TabApi[K] extends { req: infer R } ? R : never,
): Promise<TabApi[K] extends { res: infer R } ? R : never> {
  return unwrap(await browser.tabs.sendMessage(tabId, { type, ...(req as object) }));
}

export const RESPEC_READY = 'w3c-companion:respec-ready';
