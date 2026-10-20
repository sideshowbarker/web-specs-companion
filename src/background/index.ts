// One classic script serves as Chrome's service worker and as the event page in other engines, which is why the
// manifest names it in both background keys. Listeners are registered synchronously at the top level, so events that
// wake the worker reach them.
// https://w3c.github.io/webextensions/specification/#key-background
import '../shared/browser.ts';
import { CacheApiStore, createHttp } from '../data/http.ts';
import { createSources } from '../data/sources.ts';
import { badgeColor, maturityFor } from '../logic/maturity.ts';
import type { Context } from '../shared/types.ts';
import { createHandlers } from './handlers.ts';
import { omniboxTarget, suggestionFor } from './omnibox.ts';
import { ensureAlarms, runAlarm } from './refresh.ts';
import { ReviewStore } from './reviews.ts';
import type { SearchItem } from '../logic/search.ts';
import { TabStore } from './tabs.ts';

const store = new CacheApiStore();
const http = createHttp(store);
const sources = createSources({
  store,
  fetchImpl: (input, init) => fetch(input, init),
  now: Date.now,
  readBundled: async (path) => (await fetch(browser.runtime.getURL(path))).text(),
  bundledAt: async () => {
    const meta = await (await fetch(browser.runtime.getURL('data/meta.json'))).json();
    return Date.parse(meta.generatedAt);
  },
});
const tabs = new TabStore({
  get: (key) => browser.storage.session.get(key),
  set: (items) => browser.storage.session.set(items),
  remove: (key) => browser.storage.session.remove(key),
});

const reviews = new ReviewStore(
  {
    get: (key) => browser.storage.local.get(key),
    set: (items) => browser.storage.local.set(items),
    remove: (key) => browser.storage.local.remove(key),
  },
  Date.now,
);

function setBadge(tabId: number, ctx: Context) {
  const code = maturityFor(ctx);
  browser.action.setBadgeText({ tabId, text: code ?? '' }).catch(() => {});
  if (!code) return;
  browser.action.setBadgeBackgroundColor({ tabId, color: badgeColor(code) }).catch(() => {});
  browser.action.setBadgeTextColor?.({ tabId, color: '#ffffff' })?.catch(() => {});
}

const notify = (tabId: number) => {
  browser.runtime.sendMessage({ type: 'context-changed', tabId }).catch(() => {});
};

const handlers = createHandlers({ sources, http, tabs, reviews, now: Date.now, setBadge, notify });

// Answer through sendResponse, and keep the channel open, which every engine supports.
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handlers.handle(msg, sender).then(sendResponse, (err: unknown) => {
    sendResponse({ error: err instanceof Error ? err.message : String(err) });
  });
  return true;
});

browser.tabs.onUpdated.addListener((tabId, info, tab) => {
  const url = info.url ?? (info.status === 'complete' ? tab.url : undefined);
  if (url) handlers.onTabUrl(tabId, url).catch((err) => console.debug('web-specs-companion:', err));
});

browser.tabs.onRemoved.addListener((tabId) => {
  tabs.remove(tabId).catch(() => {});
});

const markup = typeof browser.runtime.getBrowserInfo !== 'function';
const find = async (q: string) => ((await handlers.handle({ type: 'search', query: q }, {})) as { items: SearchItem[] }).items;
const resolveIdl = async (name: string) => ((await handlers.handle({ type: 'resolve-idl', name }, {})) as { url: string }).url;

if (browser.omnibox) {
  browser.omnibox.setDefaultSuggestion({ description: 'Search web specs, W3C groups, Web IDL names, and terms' });
  browser.omnibox.onInputChanged.addListener((text, suggest) => {
    find(text).then((items) => suggest(items.map((i) => suggestionFor(i, markup))), () => suggest([]));
  });
  browser.omnibox.onInputEntered.addListener((text, disposition) => {
    omniboxTarget(text, find, resolveIdl).then((url) => {
      if (disposition === 'newForegroundTab') return browser.tabs.create({ url });
      if (disposition === 'newBackgroundTab') return browser.tabs.create({ url, active: false });
      return browser.tabs.update({ url });
    });
  });
}

// Alarms schedule the data refreshes. The WebExtensions WG is specifying this API: w3c/webextensions PR #1110.
browser.runtime.onInstalled.addListener(() => {
  ensureAlarms(browser.alarms).catch(() => {});
});
browser.runtime.onStartup.addListener(() => {
  ensureAlarms(browser.alarms).catch(() => {});
});
browser.alarms.onAlarm.addListener((alarm) => {
  runAlarm(alarm.name, sources, Date.now()).catch(() => {});
});

export { handlers, http, sources };
