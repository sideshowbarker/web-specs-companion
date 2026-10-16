import { GroupIndex } from '../data/groups.ts';
import type { Http } from '../data/http.ts';
import type { Sources } from '../data/sources.ts';
import { getGroupDetails, getSpecDetails } from '../data/w3capi.ts';
import { computeRadar } from '../logic/radar.ts';
import { buildSearchItems, IDL_TYPES, parseQuery, search, termSearch, webidlpediaUrl, type SearchItem } from '../logic/search.ts';
import { SpecIndex } from '../data/specs.ts';
import { eventsForGroup, nowAndNext, tpacVisible } from '../data/tpac.ts';
import { resolveContext } from '../logic/context.ts';
import type { Api, Message, MessageType } from '../shared/messages.ts';
import type { Context } from '../shared/types.ts';
import type { TabStore } from './tabs.ts';

export interface Indexes {
  specs: SpecIndex;
  groups: GroupIndex;
}

export interface HandlerDeps {
  sources: Sources;
  http: Http;
  tabs: TabStore;
  now: () => number;
  setBadge: (tabId: number, ctx: Context) => void | Promise<void>;
}

export type HandlerTable = {
  [K in MessageType]?: (msg: Extract<Message, { type: K }>, sender: chrome.runtime.MessageSender) => Promise<Api[K]['res']>;
};

export function createHandlers(deps: HandlerDeps) {
  let built: { key: string; idx: Indexes } | undefined;
  let searchItems: { key: string; items: SearchItem[] } | undefined;

  async function items(): Promise<SearchItem[]> {
    const [s, g, i] = await Promise.all([deps.sources.load('specs'), deps.sources.load('groups'), deps.sources.load('idlnames')]);
    const key = [s, g, i].map((x) => `${x.origin}:${x.fetchedAt}`).join('|');
    if (searchItems?.key !== key) searchItems = { key, items: buildSearchItems(s.data, g.data, i.data) };
    return searchItems.items;
  }

  async function indexes(): Promise<Indexes> {
    const [s, g, r] = await Promise.all([deps.sources.load('specs'), deps.sources.load('groups'), deps.sources.load('repos')]);
    const key = [s, g, r].map((x) => `${x.origin}:${x.fetchedAt}`).join('|');
    if (built?.key !== key) built = { key, idx: { specs: new SpecIndex(s.data), groups: new GroupIndex(g.data, r.data) } };
    return built.idx;
  }

  async function contextFor(tabId: number, url?: string): Promise<Context | null> {
    const state = await deps.tabs.get(tabId);
    const u = url ?? state?.url;
    if (!u) return null;
    const facts = state?.facts && state.facts.url.split('#')[0] === u.split('#')[0] ? state.facts : undefined;
    const { specs, groups } = await indexes();
    return resolveContext(u, facts, specs, groups);
  }

  const table: HandlerTable = {
    'page-facts': async (msg, sender) => {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return {};
      await deps.tabs.setFacts(tabId, msg.facts);
      const ctx = await contextFor(tabId, msg.facts.url);
      if (ctx) await deps.setBadge(tabId, ctx);
      return { shortname: ctx?.spec?.shortname };
    },
    'get-context': async (msg) => ({ context: await contextFor(msg.tabId, msg.url) }),
    'get-spec-details': async (msg) => ({ details: (await getSpecDetails(deps.http, msg.shortname).catch(() => undefined)) ?? null }),
    'get-group-details': async (msg) => ({ details: (await getGroupDetails(deps.http, msg.identifier).catch(() => undefined)) ?? null }),
    'get-radar': async (msg) => {
      const ctx = await contextFor(msg.tabId, msg.url);
      if (!ctx?.spec) return { radar: null };
      const details = ctx.spec.organization.startsWith('W3C')
        ? await getSpecDetails(deps.http, ctx.spec.shortname).catch(() => undefined)
        : undefined;
      const { specs } = await indexes();
      return { radar: computeRadar(ctx, specs, details) ?? null };
    },
    'search': async (msg) => {
      const { scope, text } = parseQuery(msg.query);
      const found = search(await items(), msg.query);
      if (scope === 'term' || (scope === 'all' && found.length === 0 && text.length > 1)) {
        const { specs } = await indexes();
        const terms = await termSearch(deps.http, specs, text).catch(() => []);
        return { items: [...found, ...terms].slice(0, 8) };
      }
      return { items: found };
    },
    'resolve-idl': async (msg) => {
      const { specs } = await indexes();
      const hits = await termSearch(deps.http, specs, msg.name, IDL_TYPES).catch(() => []);
      return { url: hits[0]?.url ?? webidlpediaUrl(msg.name) };
    },
    'get-tpac': async (msg) => {
      const t = await deps.sources.load('tpac');
      const now = deps.now();
      const { now: inSession, next } = nowAndNext(t.data, now);
      const slots: Record<string, typeof t.data> = {};
      for (const name of msg.groupNames ?? []) slots[name] = eventsForGroup(t.data, name);
      return {
        visible: tpacVisible(now),
        firstStart: t.data.find((e) => e.kind === 'group')?.start,
        now: inSession,
        next,
        slots,
        fetchedAt: t.fetchedAt,
        origin: t.origin,
      };
    },
  };

  return {
    indexes,
    contextFor,
    async handle(msg: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
      const type = (msg as { type?: unknown })?.type;
      const handler = typeof type === 'string' ? (table as Record<string, unknown>)[type] : undefined;
      if (typeof handler !== 'function') throw new Error(`unknown message ${String(type)}`);
      return handler(msg, sender);
    },
    async onTabUrl(tabId: number, url: string) {
      await deps.tabs.setUrl(tabId, url);
      const ctx = await contextFor(tabId, url);
      if (ctx) await deps.setBadge(tabId, ctx);
    },
  };
}
