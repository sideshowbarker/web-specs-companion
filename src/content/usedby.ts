import type { UsedByEntry } from '../logic/footprint.ts';

const BADGE_CSS = `
:host { all: initial; }
button {
  font: 600 11px/1 system-ui, sans-serif; color: #005a9c; background: #e8f1f8; border: 1px solid #9cc3e3;
  border-radius: 9px; padding: 1px 5px; margin-inline-start: 3px; cursor: pointer; vertical-align: super;
}
button.private { color: #5c4400; background: #fff4ce; border-color: #c9a227; }
button:focus-visible { outline: 3px solid #f9dc4a; outline-offset: 1px; }
@media (prefers-color-scheme: dark) {
  button { color: #8cc4ff; background: #10263a; border-color: #2c5a85; }
  button.private { color: #ffe9a3; background: #3d3200; border-color: #806a00; }
}`;

const POPOVER_CSS = `
:host { all: initial; position: absolute; z-index: 2147483647; }
[role="dialog"] {
  font: 13px/1.45 system-ui, sans-serif; color: #1a1a1a; background: #fff; border: 1px solid #9cc3e3;
  border-radius: 6px; box-shadow: 0 4px 16px rgb(0 0 0 / 0.2); padding: 8px 12px; width: 320px; max-height: 320px; overflow: auto;
}
p { margin: 0 0 6px; font-weight: 600; }
ul { margin: 0 0 6px; padding-inline-start: 18px; }
a { color: #005a9c; }
a:focus-visible { outline: 3px solid #f9dc4a; outline-offset: 1px; }
.more { font-size: 12px; color: #555b61; }
@media (prefers-color-scheme: dark) {
  [role="dialog"] { color: #e8ecf0; background: #11161c; border-color: #2c5a85; }
  a { color: #8cc4ff; } .more { color: #a9b3bd; }
}`;

export interface RenderOptions {
  batchSize?: number;
  schedule?: (cb: () => void) => void;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function badgeLabel(e: UsedByEntry): string {
  return e.access === 'public'
    ? `Used by ${e.count} other ${plural(e.count, 'spec', 'specs')}`
    : `Not exported, but ${e.count} other ${plural(e.count, 'spec links', 'specs link')} to it`;
}

const idle = (cb: () => void) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => cb());
  else setTimeout(cb, 0);
};

// Counts live in shadow roots on span hosts (content scripts can't define custom elements in every engine), so no page
// style reaches them, and none of theirs reaches the page.
export class UsedByLayer {
  private doc: Document;
  private map: Record<string, UsedByEntry>;
  private links: { specdex: string };
  private hosts: HTMLElement[] = [];
  private generation = 0;
  private popover?: { host: HTMLElement; opener: HTMLElement; onDocClick: (e: Event) => void };

  constructor(doc: Document, map: Record<string, UsedByEntry>, links: { specdex: string }) {
    this.doc = doc;
    this.map = map;
    this.links = links;
  }

  async render(opts: RenderOptions = {}): Promise<number> {
    const gen = ++this.generation;
    const batchSize = opts.batchSize ?? 200;
    const schedule = opts.schedule ?? idle;
    const targets = Array.from(this.doc.querySelectorAll<HTMLElement>('dfn[id]')).filter(
      (el) => this.map[el.id] && el.nextElementSibling?.getAttribute('data-wsc-usedby') !== el.id,
    );
    let inserted = 0;
    for (let i = 0; i < targets.length; i += batchSize) {
      await new Promise<void>((resolve) => schedule(resolve));
      if (gen !== this.generation) return inserted;
      for (const el of targets.slice(i, i + batchSize)) {
        if (el.nextElementSibling?.getAttribute('data-wsc-usedby') === el.id) continue;
        this.insertBadge(el, this.map[el.id]);
        inserted++;
      }
    }
    return inserted;
  }

  private insertBadge(dfn: HTMLElement, entry: UsedByEntry) {
    const host = this.doc.createElement('span');
    host.setAttribute('data-wsc-usedby', dfn.id);
    const root = host.attachShadow({ mode: 'open' });
    const style = this.doc.createElement('style');
    style.textContent = BADGE_CSS;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = `↗ ${entry.count}`;
    button.setAttribute('aria-label', badgeLabel(entry));
    if (entry.access !== 'public') button.classList.add('private');
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openPopover(entry, button);
    });
    root.append(style, button);
    dfn.after(host);
    this.hosts.push(host);
  }

  private openPopover(entry: UsedByEntry, opener: HTMLElement) {
    this.closePopover(false);
    const host = this.doc.createElement('div');
    host.setAttribute('data-wsc-popover', '');
    const root = host.attachShadow({ mode: 'open' });
    const style = this.doc.createElement('style');
    style.textContent = POPOVER_CSS;
    const dialog = this.doc.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', badgeLabel(entry));
    const head = this.doc.createElement('p');
    head.textContent = `${badgeLabel(entry)}:`;
    const list = this.doc.createElement('ul');
    for (const s of entry.specs) {
      const li = this.doc.createElement('li');
      const a = this.doc.createElement('a');
      a.href = s.url;
      a.textContent = s.title;
      li.append(a);
      list.append(li);
    }
    const more = this.doc.createElement('p');
    more.className = 'more';
    const addLink = (href: string, text: string) => {
      const a = this.doc.createElement('a');
      a.href = href;
      a.textContent = text;
      more.append(a, ' ');
    };
    if (entry.webdex) addLink(entry.webdex, 'This term on webdex');
    addLink(this.links.specdex, 'All of this spec on specdex');
    dialog.append(head, list, more);
    dialog.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        e.stopPropagation();
        this.closePopover(true);
      }
    });
    root.append(style, dialog);
    const rect = opener.getBoundingClientRect();
    const view = this.doc.defaultView;
    host.style.top = `${rect.bottom + (view?.scrollY ?? 0) + 4}px`;
    host.style.left = `${Math.max(8, Math.min(rect.left + (view?.scrollX ?? 0), (view?.innerWidth ?? 1024) - 340))}px`;
    const onDocClick = (e: Event) => {
      if (!e.composedPath().includes(host)) this.closePopover(false);
    };
    this.doc.addEventListener('click', onDocClick, true);
    this.doc.body.append(host);
    this.popover = { host, opener, onDocClick };
    root.querySelector<HTMLAnchorElement>('a')?.focus();
  }

  private closePopover(restoreFocus: boolean) {
    if (!this.popover) return;
    this.doc.removeEventListener('click', this.popover.onDocClick, true);
    this.popover.host.remove();
    if (restoreFocus) this.popover.opener.focus();
    this.popover = undefined;
  }

  clear() {
    this.generation++;
    for (const h of this.hosts) h.remove();
    this.hosts = [];
    this.closePopover(false);
  }
}
