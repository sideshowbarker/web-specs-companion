// A spec's review, in the page: Each comment made on this page has its quote found again and highlighted, in its kind's
// color, with the CSS Custom Highlight API, which leaves the page's DOM alone. Without that API, there are no
// highlights, and everything else still works. Selecting text offers a Comment button, which opens the editor.
// https://drafts.csswg.org/css-highlight-api-1/
import {
  commentMarkdown, issueLink, issueTitle, KINDS, whereLabel,
  type IssueTarget, type Kind, type Review, type ReviewComment, type Where,
} from '../logic/review.ts';
import { send } from '../shared/messages.ts';
import { findQuote, PageText, quoteOf } from './quote.ts';
import { CommentEditor, EDITOR_WIDTH, type EditorValues } from './review-editor.ts';
import { stepsText } from './steps.ts';
import { whereOf } from './where.ts';

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

const BUTTON_CSS = `
:host { all: initial; position: absolute; z-index: 2147483647; }
:host([hidden]) { display: none; }
button {
  font: 600 12px/1 system-ui, sans-serif; color: #005a9c; background: #e8f1f8; border: 1px solid #9cc3e3;
  border-radius: 9px; padding: 4px 8px; cursor: pointer; box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
}
button:focus-visible { outline: 3px solid #f9dc4a; outline-offset: 1px; }
@media (prefers-color-scheme: dark) {
  button { color: #8cc4ff; background: #10263a; border-color: #2c5a85; }
}`;

const CLIPBOARD_NOTE = 'The issue text is on your clipboard: Paste it into the issue.';

// No Comment button for text in a form field, or in the extension's own elements.
const NOT_COMMENTABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), '
  + '[data-wsc-review], [data-wsc-popover], [data-wsc-usedby]';

// The extension's own elements in the page, whose changes never change the page's text.
const OWN = '[data-wsc-review], [data-wsc-popover], [data-wsc-usedby]';

// Whether a range holds any text that isn't blank, reading only as far as the first that isn't, so a selection of a
// whole page costs no more than one of a word.
function hasText(range: Range): boolean {
  const start = range.startContainer;
  const walker = start.ownerDocument!.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let node: Node | null = start;
  if (start.nodeType !== Node.TEXT_NODE) {
    const child = start.childNodes[range.startOffset];
    walker.currentNode = child ?? start;
    node = child?.nodeType === Node.TEXT_NODE ? child : walker.nextNode();
  }
  for (let seen = 0; node && seen < 10000; node = walker.nextNode(), seen++) {
    const text = node as Text;
    if (range.comparePoint(text, 0) > 0) return false;
    const from = text === range.startContainer ? range.startOffset : 0;
    const to = text === range.endContainer ? range.endOffset : text.length;
    if (range.intersectsNode(text) && /\S/.test(text.data.slice(from, to))) return true;
  }
  return node !== null;
}

// A click on these is never taken as a click on a comment's highlight.
const NOT_REOPENING = 'a, button, input, textarea, select, summary, label, [contenteditable], '
  + '[data-wsc-review], [data-wsc-popover], [data-wsc-usedby]';

const elementOf = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement);

// The rect at a range's end, from the collapsed end alone: Measuring a whole page's selection means a rect per line.
function endRect(range: Range): DOMRect | undefined {
  const end = range.cloneRange();
  end.collapse(false);
  const rects = typeof end.getClientRects === 'function' ? end.getClientRects() : undefined;
  if (rects && rects.length > 0) return rects[rects.length - 1];
  return elementOf(end.endContainer)?.getBoundingClientRect();
}

// A selection's text as the reader sees it, each line trimmed, with runs of blank lines made one.
const plain = (text: string) =>
  text.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n\n+/g, '\n\n').trim();

interface Editing {
  ui: CommentEditor;
  range?: Range;
  where: Where;
  excerpt: string;
  comment?: ReviewComment;
}

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
  private lengths = new Map<string, number>();
  private observer?: MutationObserver;
  private buttonOn: boolean;
  private buttonHost?: HTMLElement;
  private editor?: Editing;

  constructor(doc: Document, opts: { shortname: string; button?: boolean }) {
    this.doc = doc;
    this.shortname = opts.shortname;
    this.url = doc.URL.split('#')[0];
    this.buttonOn = opts.button ?? true;
  }

  async start(): Promise<void> {
    this.observer = new MutationObserver((records) => this.forget(records));
    this.observer.observe(this.doc.body, { childList: true, characterData: true, subtree: true });
    this.doc.addEventListener('selectionchange', this.onSelectionChange);
    this.doc.addEventListener('click', this.onClick);
    const answer = await send('get-review', { shortname: this.shortname });
    this.title = answer.title;
    this.target = answer.target;
    this.update(answer.review);
  }

  setButton(on: boolean): void {
    this.buttonOn = on;
    if (!on && this.buttonHost) this.buttonHost.hidden = true;
  }

  // Opens the editor for the selected text; false when there's none to comment on.
  openEditor(): boolean {
    const range = this.selectedRange();
    if (!range) return false;
    const kept = range.cloneRange();
    const steps = stepsText(kept);
    // A quote of one step gets no number out of context: Only several steps keep theirs.
    const excerpt = steps?.includes('\n') ? steps : plain(this.doc.getSelection()?.toString() ?? kept.toString());
    this.openWith({ range: kept, where: whereOf(kept), excerpt }, { kind: 'comment', title: '', text: '' });
    return true;
  }

  // Opens the editor on one of this page's comments; false for a comment this page doesn't have.
  edit(id: string): boolean {
    const c = this.review?.comments.find((each) => each.id === id && each.url === this.url);
    if (!c) return false;
    this.openWith({ range: this.ranges.get(id), where: c.where, excerpt: c.excerpt, comment: c }, c);
    return true;
  }

  update(review: Review | null): void {
    this.review = review;
    const mine = (review?.comments ?? []).filter((c) => c.url === this.url);
    this.ranges.clear();
    this.lengths.clear();
    this.notFound = [];
    if (mine.length > 0) {
      const page = this.pageText();
      for (const c of mine) {
        this.lengths.set(c.id, c.quote.exact.length);
        const range = findQuote(page, c.quote);
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
    this.observer?.disconnect();
    this.doc.removeEventListener('selectionchange', this.onSelectionChange);
    this.doc.removeEventListener('click', this.onClick);
    this.closeEditor();
    this.buttonHost?.remove();
    this.buttonHost = undefined;
    clearTimeout(this.flashTimer);
    const api = this.api();
    for (const name of [...this.names, FLASH]) api?.registry.delete(name);
    this.names.clear();
    this.style?.remove();
    this.style = undefined;
  }

  private selectedRange(): Range | undefined {
    const selection = this.doc.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return undefined;
    const range = selection.getRangeAt(0);
    if (!hasText(range)) return undefined;
    for (const node of [range.startContainer, range.endContainer]) {
      const el = elementOf(node);
      if (!el || !this.doc.body.contains(el) || el.closest(NOT_COMMENTABLE)) return undefined;
    }
    return range;
  }

  private onSelectionChange = () => {
    const range = this.buttonOn && !this.editor ? this.selectedRange() : undefined;
    if (!range) {
      if (this.buttonHost) this.buttonHost.hidden = true;
      return;
    }
    const host = this.buttonHost ?? this.makeButton();
    host.hidden = false;
    const rect = endRect(range);
    const view = this.doc.defaultView;
    const left = Math.min((rect?.right ?? 0) + 4, (view?.innerWidth ?? 1024) - 96);
    host.style.left = `${Math.max(0, left) + (view?.scrollX ?? 0)}px`;
    host.style.top = `${(rect?.top ?? 0) + (view?.scrollY ?? 0)}px`;
  };

  private makeButton(): HTMLElement {
    const host = this.doc.createElement('span');
    host.setAttribute('data-wsc-review', 'button');
    const root = host.attachShadow({ mode: 'open' });
    const style = this.doc.createElement('style');
    style.textContent = BUTTON_CSS;
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Comment';
    button.setAttribute('aria-label', 'Comment on the selected text');
    // Pressing the button keeps the selection it's for.
    button.addEventListener('mousedown', (e) => e.preventDefault());
    button.addEventListener('click', () => this.openEditor());
    root.append(style, button);
    this.doc.body.append(host);
    this.buttonHost = host;
    return host;
  }

  // A click on a comment's highlight opens that comment, or the shortest of the comments under the click.
  private onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || this.ranges.size === 0) return;
    if ((e.target as Element | null)?.closest?.(NOT_REOPENING)) return;
    const selection = this.doc.getSelection();
    if (selection && !selection.isCollapsed) return;
    const point = this.caretAt(e.clientX, e.clientY);
    if (!point) return;
    let best: { id: string; length: number } | undefined;
    for (const [id, range] of this.ranges) {
      let inside = false;
      try {
        inside = range.comparePoint(point.node, point.offset) === 0;
      } catch {
        // The point is in another tree.
      }
      const length = this.lengths.get(id) ?? 0;
      if (inside && (!best || length < best.length)) best = { id, length };
    }
    if (best) this.edit(best.id);
  };

  private caretAt(x: number, y: number): { node: Node; offset: number } | undefined {
    const doc = this.doc;
    if (typeof doc.caretPositionFromPoint === 'function') {
      const caret = doc.caretPositionFromPoint(x, y);
      return caret ? { node: caret.offsetNode, offset: caret.offset } : undefined;
    }
    if (typeof doc.caretRangeFromPoint === 'function') {
      const caret = doc.caretRangeFromPoint(x, y);
      return caret ? { node: caret.startContainer, offset: caret.startOffset } : undefined;
    }
    return undefined;
  }

  private openWith(state: Omit<Editing, 'ui'>, values: EditorValues) {
    this.closeEditor();
    if (this.buttonHost) this.buttonHost.hidden = true;
    const label = whereLabel(state.where, this.title);
    const ui = new CommentEditor(
      this.doc,
      { ...values, label, excerpt: state.excerpt, editing: !!state.comment, canFile: !!this.target },
      {
        save: (v) => void this.save(v),
        file: (v) => void this.file(v),
        cancel: () => this.closeEditor(),
        remove: () => void this.remove(),
      },
    );
    this.editor = { ...state, ui };
    this.doc.body.append(ui.host);
    const view = this.doc.defaultView;
    const scrollX = view?.scrollX ?? 0;
    const scrollY = view?.scrollY ?? 0;
    const rect = state.range ? endRect(state.range) : undefined;
    const left = Math.max(8, Math.min(rect?.left ?? 16, (view?.innerWidth ?? 1024) - EDITOR_WIDTH - 8));
    ui.placeAt((rect ? rect.bottom + 8 : 80) + scrollY, left + scrollX);
    ui.focus();
  }

  private closeEditor() {
    this.editor?.ui.close();
    this.editor = undefined;
  }

  // The comment the editor holds, as it would be saved: An edited one keeps its quote, place, and creation time.
  private build(v: EditorValues): ReviewComment | undefined {
    const editing = this.editor;
    if (!editing) return undefined;
    const now = Date.now();
    const words = { kind: v.kind, title: v.title.trim(), text: v.text.trim(), updated: now };
    if (editing.comment) return { ...editing.comment, ...words };
    if (!editing.range) return undefined;
    const q = quoteOf(this.pageText(), editing.range);
    if (!q) return undefined;
    return {
      id: crypto.randomUUID(), ...words, url: this.url, quote: q.quote, context: q.context, excerpt: editing.excerpt,
      where: editing.where, position: q.position, created: now,
    };
  }

  private async save(v: EditorValues) {
    const c = this.build(v);
    if (!c) return;
    this.closeEditor();
    const { review } = await send('save-comment', { shortname: this.shortname, comment: c });
    this.update(review);
  }

  private async remove() {
    const id = this.editor?.comment?.id;
    this.closeEditor();
    if (!id) return;
    const { review } = await send('delete-comment', { shortname: this.shortname, id });
    this.update(review);
  }

  // Files the comment as a new issue. The new tab opens before anything awaits, while the click still counts as the
  // user's, and an issue too long for its link goes on the clipboard instead.
  private async file(v: EditorValues) {
    const target = this.target;
    const editing = this.editor;
    const c = this.build(v);
    if (!c || !target || !editing) return;
    const body = commentMarkdown(c, this.title);
    const { url, tooLong } = issueLink(target, issueTitle(c, target, this.title), body);
    if (tooLong) navigator.clipboard?.writeText(body)?.catch(() => {});
    this.doc.defaultView?.open(url, '_blank', 'noopener');
    if (!tooLong) this.closeEditor();
    await send('save-comment', { shortname: this.shortname, comment: c });
    const { review } = await send('mark-filed', { shortname: this.shortname, ids: [c.id] });
    this.update(review);
    if (!tooLong) return;
    const saved = review?.comments.find((each) => each.id === c.id) ?? c;
    this.openWith({ range: editing.range, where: c.where, excerpt: c.excerpt, comment: saved }, saved);
    this.editor?.ui.note(CLIPBOARD_NOTE);
  }

  // The page's text, read again once the page has changed it since the last reading.
  private pageText(): PageText {
    if (this.observer) this.forget(this.observer.takeRecords());
    return (this.page ??= new PageText(this.doc.body));
  }

  // Changes inside the extension's own elements, or that only add or remove them, leave the page's text as it was.
  private forget(records: MutationRecord[]) {
    const isOwn = (n: Node) => n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(OWN);
    const own = (r: MutationRecord) =>
      !!elementOf(r.target)?.closest(OWN)
      || (r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every(isOwn));
    if (records.some((r) => !own(r))) this.page = undefined;
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
