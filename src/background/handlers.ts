import { GroupIndex } from '../data/groups.ts';
import type { Http } from '../data/http.ts';
import type { Sources } from '../data/sources.ts';
import { getGroupDetails, getSpecDetails } from '../data/w3capi.ts';
import { getExtract, getWebrefIndex, isoFromSpecDate, type WebrefEntry } from '../data/webref.ts';
import { caniuseFeatures } from '../logic/caniuse.ts';
import { buildUsedByMap, computeFootprint, specdexUrl } from '../logic/footprint.ts';
import { isImplRecord } from '../logic/implementations.ts';
import { mdnView } from '../logic/mdn.ts';
import { checkLinks, type TargetData } from '../logic/linkcheck.ts';
import { computeRadar } from '../logic/radar.ts';
import { fragmentOf } from '../shared/url.ts';
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
  /** Tells open panels that a tab's context changed after its URL did (page facts arrive later). */
  notify?: (tabId: number) => void;
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
      deps.notify?.(tabId);
      return { shortname: ctx?.spec?.shortname };
    },
    'get-context': async (msg) => ({ context: await contextFor(msg.tabId, msg.url) }),
    'get-spec-details': async (msg) => ({ details: (await getSpecDetails(deps.http, msg.shortname).catch(() => undefined)) ?? null }),
    'get-group-details': async (msg) => ({ details: (await getGroupDetails(deps.http, msg.identifier).catch(() => undefined)) ?? null }),
    'get-radar': async (msg) => {
      const ctx = await contextFor(msg.tabId, msg.url);
      if (!ctx?.spec) return { radar: null };
      const { shortname } = ctx.spec;
      const details = ctx.spec.organization.startsWith('W3C')
        ? await getSpecDetails(deps.http, shortname).catch(() => undefined)
        : undefined;
      // A latest-TR page shows only its own date, so the draft's comes from webref's crawl of the draft.
      const draftDate = ctx.pageKind === 'tr' && details?.trDate
        ? await getWebrefIndex(deps.http, deps.now).then((i) => isoFromSpecDate(i.entries.get(shortname)?.date), () => undefined)
        : undefined;
      const { specs } = await indexes();
      return { radar: computeRadar(ctx, specs, details, draftDate) ?? null };
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
    'get-footprint': async (msg) => {
      const { entries } = await getWebrefIndex(deps.http, deps.now).catch(() => ({ entries: new Map<string, WebrefEntry>() }));
      const entry = entries.get(msg.shortname);
      if (!entry) return { footprint: null };
      const safe = <T>(p: Promise<T>) => p.catch(() => undefined);
      const [backrefs, links, refs, idlparsed] = await Promise.all([
        safe(getExtract(deps.http, entry, 'backrefs')),
        safe(getExtract(deps.http, entry, 'links')),
        safe(getExtract(deps.http, entry, 'refs')),
        safe(getExtract(deps.http, entry, 'idlparsed')),
      ]);
      const { specs } = await indexes();
      return {
        footprint: computeFootprint(
          { backrefs: backrefs?.backrefs, links: links?.links, refs: refs?.refs, idlparsed: idlparsed?.idlparsed },
          msg.shortname, specs, entry,
        ),
      };
    },
    'get-used-by': async (msg) => {
      const specdex = specdexUrl(msg.shortname);
      const { entries } = await getWebrefIndex(deps.http, deps.now).catch(() => ({ entries: new Map<string, WebrefEntry>() }));
      const file = await getExtract(deps.http, entries.get(msg.shortname), 'backrefs').catch(() => undefined);
      if (!file) return { map: null, specdex };
      const { specs } = await indexes();
      const series = specs.get(msg.shortname)?.series.shortname ?? msg.shortname;
      return { map: buildUsedByMap(file.backrefs, msg.shortname, series), specdex };
    },
    'get-implementations': async (msg) => {
      const file = await deps.sources.load('implementations').then((l) => l.data, () => undefined);
      if (!file) return { impl: null };
      // A copy stored by another version of the extension isn't slimmed again, so check each record here too.
      const record = (shortname: string) => {
        const r = Object.hasOwn(file.specs, shortname) ? file.specs[shortname] : undefined;
        return isImplRecord(r) ? r : undefined;
      };
      const own = record(msg.shortname);
      if (own) return { impl: { ...own, bcd: file.bcd } };
      // BCD files an older level's features under the current level, since their spec URLs don't name a level.
      const { specs } = await indexes();
      const current = specs.get(msg.shortname)?.series.currentSpecification;
      const series = current && current !== msg.shortname ? record(current) : undefined;
      if (!current || !series) return { impl: null };
      return { impl: { ...series, bcd: file.bcd, fromSeries: { shortname: current, title: specs.get(current)?.title ?? current } } };
    },
    'get-mdn': async (msg) => {
      const file = await deps.sources.load('mdn').then((l) => l.data, () => undefined);
      if (!file) return { mdn: null };
      const own = mdnView(file, msg.shortname);
      if (own) return { mdn: own };
      // MDN's pages cite a series by URLs that name no level, so their articles are filed under the current level.
      const { specs } = await indexes();
      const current = specs.get(msg.shortname)?.series.currentSpecification;
      const series = current && current !== msg.shortname ? mdnView(file, current) : undefined;
      if (!current || !series) return { mdn: null };
      return { mdn: { ...series, fromSeries: { shortname: current, title: specs.get(current)?.title ?? current } } };
    },
    'get-caniuse': async (msg) => {
      const file = await deps.sources.load('caniuse').then((l) => l.data, () => undefined);
      const source = file?.caniuse;
      if (!file || typeof source?.version !== 'string' || typeof source.updated !== 'string') return { caniuse: null };
      const kept = { version: source.version, updated: source.updated };
      const own = caniuseFeatures(file, msg.shortname);
      if (own.length > 0) return { caniuse: { features: own, source: kept } };
      // caniuse's spec links cite a series by URLs that name no level, so its features are filed under the current one.
      const { specs } = await indexes();
      const current = specs.get(msg.shortname)?.series.currentSpecification;
      const series = current && current !== msg.shortname ? caniuseFeatures(file, current) : [];
      if (!current || series.length === 0) return { caniuse: null };
      return { caniuse: { features: series, source: kept, fromSeries: { shortname: current, title: specs.get(current)?.title ?? current } } };
    },
    'check-links': async (msg) => {
      const index = await getWebrefIndex(deps.http, deps.now);
      const { specs } = await indexes();
      const loadTarget = async (shortname: string): Promise<TargetData | undefined> => {
        const entry = index.entries.get(shortname);
        const [ids, dfns] = await Promise.all([getExtract(deps.http, entry, 'ids'), getExtract(deps.http, entry, 'dfns')]);
        if (!ids) return undefined;
        const fragments = new Map<string, string>();
        for (const url of ids.ids) {
          const f = fragmentOf(url);
          if (f) fragments.set(f, url);
        }
        return { fragments, dfns: dfns?.dfns ?? [] };
      };
      const result = await checkLinks(msg.links, msg.shortname, specs, loadTarget);
      return { ...result, crawlDate: index.date };
    },
    'get-freshness': async () => {
      const names = tpacVisible(deps.now()) ? (['specs', 'groups', 'repos', 'implementations', 'mdn', 'caniuse', 'tpac'] as const) : (['specs', 'groups', 'repos', 'implementations', 'mdn', 'caniuse'] as const);
      const loaded = await Promise.all(names.map((n) => deps.sources.load(n).catch(() => undefined)));
      return {
        sources: loaded.flatMap((l, i) => (l ? [{ name: names[i], fetchedAt: l.fetchedAt, origin: l.origin }] : [])),
      };
    },
    'get-tpac': async (msg) => {
      const now = deps.now();
      // Outside the TPAC window, the section is hidden, so don't fetch the calendar at all.
      if (!tpacVisible(now)) return { visible: false, now: [], next: [], slots: {}, fetchedAt: 0, origin: 'bundled' };
      const t = await deps.sources.load('tpac');
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
