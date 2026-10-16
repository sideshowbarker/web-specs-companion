import { useEffect, useState } from 'preact/hooks';
import { activeTab, type ActiveTab, send } from './api.ts';
import { useAsync } from './hooks.ts';
import { ContextView } from './components/ContextView.tsx';
import { Footer } from './components/Footer.tsx';
import { Search } from './components/Search.tsx';
import { Tpac } from './components/Tpac.tsx';

export function App({ surface }: { surface: 'popup' | 'sidepanel' }) {
  const [tab, setTab] = useState<ActiveTab>();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => {
      activeTab().then(setTab, () => {});
    };
    refresh();
    if (surface !== 'sidepanel') return;
    const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (info.url || info.status === 'complete') refresh();
    };
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [surface]);

  // The background says when a tab's context changed after its URL did (page facts arrive later).
  useEffect(() => {
    const onMessage = (msg: unknown) => {
      const m = msg as { type?: string; tabId?: number };
      if (m?.type === 'context-changed' && m.tabId === tab?.id) setVersion((v) => v + 1);
      return false;
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, [tab?.id]);

  const ctx = useAsync(
    async () => (tab ? (await send('get-context', { tabId: tab.id, url: tab.url })).context : null),
    [tab?.id, tab?.url, version],
  );
  const groupNames = ctx.value?.groups.map((g) => g.name) ?? [];
  const tpac = useAsync(() => send('get-tpac', { groupNames }), [groupNames.join('|')]);

  return (
    <main>
      <Search />
      {ctx.loading && !ctx.value ? (
        <p class="muted" aria-live="polite">{'Looking this page up…'}</p>
      ) : (
        <ContextView ctx={ctx.value ?? null} tabId={tab?.id} slots={tpac.value?.slots ?? {}} />
      )}
      <Tpac view={tpac.value} />
      <Footer surface={surface} windowId={tab?.windowId} />
    </main>
  );
}
