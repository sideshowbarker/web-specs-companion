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

function setBadge(tabId: number, ctx: Context) {
  const code = maturityFor(ctx);
  browser.action.setBadgeText({ tabId, text: code ?? '' }).catch(() => {});
  if (!code) return;
  browser.action.setBadgeBackgroundColor({ tabId, color: badgeColor(code) }).catch(() => {});
  browser.action.setBadgeTextColor?.({ tabId, color: '#ffffff' })?.catch(() => {});
}

const handlers = createHandlers({ sources, http, tabs, now: Date.now, setBadge });

// Answer through sendResponse, and keep the channel open, which every engine supports.
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handlers.handle(msg, sender).then(sendResponse, (err: unknown) => {
    sendResponse({ error: err instanceof Error ? err.message : String(err) });
  });
  return true;
});

browser.tabs.onUpdated.addListener((tabId, info, tab) => {
  const url = info.url ?? (info.status === 'complete' ? tab.url : undefined);
  if (url) handlers.onTabUrl(tabId, url).catch((err) => console.debug('w3c-companion:', err));
});

browser.tabs.onRemoved.addListener((tabId) => {
  tabs.remove(tabId).catch(() => {});
});

export { handlers, http, sources };
