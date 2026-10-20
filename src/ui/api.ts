export { send, sendToTab } from '../shared/messages.ts';

export interface ActiveTab {
  id: number;
  url?: string;
  windowId?: number;
}

export async function activeTab(): Promise<ActiveTab | undefined> {
  const [t] = await browser.tabs.query({ active: true, currentWindow: true });
  return t?.id === undefined ? undefined : { id: t.id, url: t.url, windowId: t.windowId };
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// Sends the tab to another URL: The page another page's review comment was made on.
export function navigate(tabId: number, url: string): void {
  browser.tabs.update(tabId, { url }).catch(() => {});
}

// Calls back whenever a spec's review changes in storage; returns the function that stops listening.
export function onReviewChanged(shortname: string, cb: () => void): () => void {
  const key = `review:${shortname}`;
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && key in changes) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

// Calls back whenever the page in a tab has placed its review, so the panel can ask again what it found; returns the
// function that stops listening.
export function onReviewPlaced(tabId: number, cb: () => void): () => void {
  const listener = (msg: unknown, sender: chrome.runtime.MessageSender) => {
    if ((msg as { type?: unknown })?.type === 'review-placed' && sender.tab?.id === tabId) cb();
    return false;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

// Links in the panel open in a tab: A plain link click would navigate the popup itself.
export function open(url: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
  const background = !!(e?.ctrlKey || e?.metaKey);
  browser.tabs.create({ url, active: !background }).catch(() => {});
}
