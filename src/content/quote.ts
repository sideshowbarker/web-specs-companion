// The page's text, for quoting it and finding a quote again: Every text node outside scripts, styles, templates, and
// the extension's own elements, with each run of whitespace collapsed to one space, and a space between blocks. A
// comment keeps its quote with the text on either side, so a later visit can find it in a page that has changed.
import type { Quote } from '../logic/review.ts';

export const QUOTE_CONTEXT = 32;

const CONTEXT_WORDS = 3;

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

const BLOCKS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION',
  'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
]);

// The whitespace that HTML collapses:
// https://infra.spec.whatwg.org/#ascii-whitespace
const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';

export class PageText {
  readonly text: string;
  private root: Element;
  private nodes: Text[] = [];
  // Where each node's characters start in the text, and whether a space was pending there.
  private starts: number[] = [];
  private pendingAt: boolean[] = [];
  private index = new Map<Text, number>();
  private boundaries: number[] = [];

  constructor(root: Element) {
    this.root = root;
    const chunks: string[] = [];
    let length = 0;
    let pending = false;
    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node as Text;
        this.index.set(text, this.nodes.length);
        this.nodes.push(text);
        this.starts.push(length);
        this.pendingAt.push(pending);
        let out = '';
        for (const c of text.data) {
          if (isSpace(c)) {
            pending = true;
            continue;
          }
          if (pending && length + out.length > 0) out += ' ';
          pending = false;
          out += c;
        }
        chunks.push(out);
        length += out.length;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (SKIPPED.has(el.tagName) || el.hasAttribute('data-wsc-review')) return;
      const block = BLOCKS.has(el.tagName);
      if (block) {
        pending = true;
        this.boundaries.push(length);
      }
      for (let child = el.firstChild; child; child = child.nextSibling) visit(child);
      if (block) {
        pending = true;
        this.boundaries.push(length);
      }
    };
    visit(root);
    this.text = chunks.join('');
  }

  // The offset in the text of a boundary point in the page.
  offsetAt(container: Node, offset: number): number {
    const k = container.nodeType === Node.TEXT_NODE ? this.index.get(container as Text) : undefined;
    if (k !== undefined) return this.countTo(k, offset);
    if (container.nodeType === Node.TEXT_NODE) return this.firstTextFrom(after(container));
    return this.firstTextFrom(container.childNodes[offset] ?? after(container));
  }

  // The range of the page that the text from start up to end comes from.
  rangeOf(start: number, end: number): Range {
    const range = this.root.ownerDocument.createRange();
    const first = this.nodeAt(start);
    const last = this.nodeAt(end - 1);
    range.setStart(this.nodes[first], this.rawAt(first, start, false));
    range.setEnd(this.nodes[last], this.rawAt(last, end - 1, true));
    return range;
  }

  // The block boundaries on either side of an offset, or the text's ends.
  blockBounds(offset: number): [number, number] {
    let lo = 0;
    let hi = this.text.length;
    for (const b of this.boundaries) {
      if (b <= offset) lo = b;
      else {
        hi = b;
        break;
      }
    }
    return [lo, hi];
  }

  // The offset of the first character of the text that comes at or after a node, in document order.
  private firstTextFrom(node: Node | null): number {
    if (!node) return this.text.length;
    const walker = this.root.ownerDocument.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    for (let n: Node | null = node; n; n = walker.nextNode()) {
      const k = n.nodeType === Node.TEXT_NODE ? this.index.get(n as Text) : undefined;
      if (k !== undefined) return this.starts[k];
    }
    return this.text.length;
  }

  // The text written for a node's characters before a raw offset, replayed from the state at the node's start.
  private countTo(k: number, raw: number): number {
    const data = this.nodes[k].data;
    let n = this.starts[k];
    let pending = this.pendingAt[k];
    for (let i = 0; i < raw && i < data.length; i++) {
      if (isSpace(data[i])) {
        pending = true;
        continue;
      }
      if (pending && n > 0) n++;
      pending = false;
      n++;
    }
    return n;
  }

  // The raw offset in a node of the character at a text offset: before it for a range's start, after it for its end.
  // A collapsed space maps to the character after it, so neither end takes in whitespace the text left out.
  private rawAt(k: number, offset: number, end: boolean): number {
    const data = this.nodes[k].data;
    let n = this.starts[k];
    let pending = this.pendingAt[k];
    for (let i = 0; i < data.length; i++) {
      if (isSpace(data[i])) {
        pending = true;
        continue;
      }
      if (pending && n > 0) {
        if (n === offset) return i;
        n++;
      }
      pending = false;
      if (n === offset) return end ? i + 1 : i;
      n++;
    }
    return data.length;
  }

  // The last node whose characters start at or before an offset, which is the node the character there came from.
  private nodeAt(offset: number): number {
    let lo = 0;
    let hi = this.nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}

// The node that follows a node's subtree in document order.
function after(node: Node): Node | null {
  for (let n: Node | null = node; n; n = n.parentNode) if (n.nextSibling) return n.nextSibling;
  return null;
}

const words = (s: string) => s.split(' ').filter(Boolean);

// A selection's quote, with the text on either side, the words around it in its own block, and its offset; nothing for
// a selection of only whitespace.
export function quoteOf(page: PageText, range: Range):
  { quote: Quote; context: { before?: string; after?: string }; position: number } | undefined {
  const t = page.text;
  let start = page.offsetAt(range.startContainer, range.startOffset);
  let end = page.offsetAt(range.endContainer, range.endOffset);
  while (start < end && t[start] === ' ') start++;
  while (end > start && t[end - 1] === ' ') end--;
  if (start >= end) return undefined;
  const quote = {
    exact: t.slice(start, end),
    prefix: t.slice(Math.max(0, start - QUOTE_CONTEXT), start),
    suffix: t.slice(end, end + QUOTE_CONTEXT),
  };
  const before = words(t.slice(page.blockBounds(start)[0], start)).slice(-CONTEXT_WORDS).join(' ');
  const after = words(t.slice(end, page.blockBounds(end - 1)[1])).slice(0, CONTEXT_WORDS).join(' ');
  return { quote, context: { ...(before ? { before } : {}), ...(after ? { after } : {}) }, position: start };
}

const commonPrefix = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};

const commonSuffix = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};

// A quote found again: Of the places its exact text occurs, the one whose surrounding text matches the most of what was
// saved, or the first of those that tie. Nothing when the exact text doesn't occur at all.
export function findQuote(page: PageText, quote: Quote): Range | undefined {
  const t = page.text;
  const { exact, prefix, suffix } = quote;
  if (!exact) return undefined;
  let best = -1;
  let bestScore = -1;
  for (let i = t.indexOf(exact); i >= 0; i = t.indexOf(exact, i + 1)) {
    const p = commonSuffix(t.slice(Math.max(0, i - prefix.length), i), prefix);
    const s = commonPrefix(t.slice(i + exact.length, i + exact.length + suffix.length), suffix);
    if (p === prefix.length && s === suffix.length) return page.rangeOf(i, i + exact.length);
    if (p + s > bestScore) {
      bestScore = p + s;
      best = i;
    }
  }
  return best < 0 ? undefined : page.rangeOf(best, best + exact.length);
}
