import type { PageFacts } from '../shared/types.ts';

export interface TabState {
  url: string;
  facts?: PageFacts;
}

export interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

const sameDoc = (a: string, b: string) => a.split('#')[0] === b.split('#')[0];

// Per-tab state lives in storage.session: It survives the background worker being suspended between events, and is
// cleared when the browser restarts.
export class TabStore {
  private area: SessionArea;
  constructor(area: SessionArea) {
    this.area = area;
  }
  private key(tabId: number) {
    return `tab:${tabId}`;
  }
  async get(tabId: number): Promise<TabState | undefined> {
    const k = this.key(tabId);
    return (await this.area.get(k))[k] as TabState | undefined;
  }
  async setFacts(tabId: number, facts: PageFacts) {
    await this.area.set({ [this.key(tabId)]: { url: facts.url, facts } satisfies TabState });
  }
  async setUrl(tabId: number, url: string) {
    const prev = await this.get(tabId);
    if (prev && prev.url === url) return;
    const facts = prev?.facts && sameDoc(prev.facts.url, url) ? prev.facts : undefined;
    await this.area.set({ [this.key(tabId)]: { url, facts } satisfies TabState });
  }
  async remove(tabId: number) {
    await this.area.remove(this.key(tabId));
  }
}
