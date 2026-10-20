// A spec's review, in the page: Each comment made on this page has its quote found again and highlighted, in its kind's
// color, with the CSS Custom Highlight API, which leaves the page's DOM alone. Without that API, there are no
// highlights, and everything else still works.
// https://drafts.csswg.org/css-highlight-api-1/
import { KINDS, type IssueTarget, type Kind, type Review } from '../logic/review.ts';
import { send } from '../shared/messages.ts';
import { findQuote, PageText } from './quote.ts';

const FLASH = 'wsc-review-flash';
const FLASH_MS = 1500;
const highlightName = (kind: Kind) => `wsc-review-${kind}`;

// Each kind's background, then its underline.
const COLORS: Record<Kind, [string, string]> = {
  major: ['rgb(209 36 47 / 0.18)', 'rgb(209 36 47)'],
  minor: ['rgb(191 135 0 / 0.2)', 'rgb(191 135 0)'],
  comment: ['rgb(9 105 218 / 0.15)', 'rgb(9 105 218)'],
  nit: ['rgb(110 119 129 / 0.18)', 'rgb(110 119 129)'],
};

const HIGHLIGHT_CSS = [
  ...KINDS.map((k) => {
    const [background, underline] = COLORS[k];
    const rules = `background-color: ${background}; text-decoration: underline 2px ${underline};`;
    return `::highlight(${highlightName(k)}) { ${rules} }`;
  }),
  `::highlight(${FLASH}) { background-color: rgb(249 220 74 / 0.6); }`,
].join('\n');

interface HighlightApi {
  registry: { set(name: string, highlight: object): unknown; delete(name: string): unknown };
  Highlight: new (...ranges: Range[]) => object;
}

export class ReviewLayer {
  private doc: Document;
  private shortname: string;
  private url: string;
  private title = '';
  private target: IssueTarget | null = null;
  private review: Review | null = null;
  // The ranges of this page's comments that were found, by id, and the ids of the ones that weren't.
  private ranges = new Map<string, Range>();
  private notFound: string[] = [];
  private page?: PageText;
  private style?: HTMLStyleElement;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private names = new Set<string>();

  constructor(doc: Document, opts: { shortname: string }) {
    this.doc = doc;
    this.shortname = opts.shortname;
    this.url = doc.URL.split('#')[0];
  }

  async start(): Promise<void> {
    const answer = await send('get-review', { shortname: this.shortname });
    this.title = answer.title;
    this.target = answer.target;
    this.update(answer.review);
  }

  update(review: Review | null): void {
    this.review = review;
    const mine = (review?.comments ?? []).filter((c) => c.url === this.url);
    this.ranges.clear();
    this.notFound = [];
    if (mine.length > 0) {
      this.page ??= new PageText(this.doc.body);
      for (const c of mine) {
        const range = findQuote(this.page, c.quote);
        if (range) this.ranges.set(c.id, range);
        else this.notFound.push(c.id);
      }
    }
    const api = this.api();
    if (!api) return;
    this.addStyle();
    for (const kind of KINDS) {
      const name = highlightName(kind);
      const ranges = mine.filter((c) => c.kind === kind && this.ranges.has(c.id)).map((c) => this.ranges.get(c.id)!);
      if (ranges.length > 0) {
        api.registry.set(name, new api.Highlight(...ranges));
        this.names.add(name);
      } else if (this.names.delete(name)) {
        api.registry.delete(name);
      }
    }
  }

  // Scrolls a comment's quote into view, and flashes it.
  show(id: string): boolean {
    const range = this.ranges.get(id);
    if (!range) return false;
    const node = range.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const api = this.api();
    if (api) {
      api.registry.set(FLASH, new api.Highlight(range));
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => api.registry.delete(FLASH), FLASH_MS);
    }
    return true;
  }

  missing(): string[] {
    return [...this.notFound];
  }

  stop(): void {
    clearTimeout(this.flashTimer);
    const api = this.api();
    for (const name of [...this.names, FLASH]) api?.registry.delete(name);
    this.names.clear();
    this.style?.remove();
    this.style = undefined;
  }

  private api(): HighlightApi | undefined {
    const view = this.doc.defaultView as
      | (Window & { CSS?: { highlights?: HighlightApi['registry'] }; Highlight?: HighlightApi['Highlight'] })
      | null;
    const registry = view?.CSS?.highlights;
    const Highlight = view?.Highlight;
    return registry && Highlight ? { registry, Highlight } : undefined;
  }

  private addStyle() {
    if (this.style) return;
    this.style = this.doc.createElement('style');
    this.style.setAttribute('data-wsc-review', 'style');
    this.style.textContent = HIGHLIGHT_CSS;
    this.doc.head.append(this.style);
  }
}
