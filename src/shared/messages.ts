import type { Context, PageFacts } from './types.ts';

export interface Api {
  'page-facts': { req: { facts: PageFacts }; res: { shortname?: string } };
  'get-context': { req: { tabId: number; url?: string }; res: { context: Context | null } };
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TabApi {}
export type TabMessage = { [K in keyof TabApi]: { type: K } & TabApi[K]['req'] }[keyof TabApi];

export async function sendToTab<K extends keyof TabApi>(
  tabId: number,
  type: K,
  req: TabApi[K] extends { req: infer R } ? R : never,
): Promise<TabApi[K] extends { res: infer R } ? R : never> {
  return unwrap(await browser.tabs.sendMessage(tabId, { type, ...(req as object) }));
}

export const RESPEC_READY = 'w3c-companion:respec-ready';
