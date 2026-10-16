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

// Links in the panel open in a tab: A plain link click would navigate the popup itself.
export function open(url: string, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
  const background = !!(e?.ctrlKey || e?.metaKey);
  browser.tabs.create({ url, active: !background }).catch(() => {});
}
