// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReviewStore } from '../src/background/reviews.ts';
import { PageText, quoteOf } from '../src/content/quote.ts';
import { ReviewLayer } from '../src/content/review.ts';
import { whereOf } from '../src/content/where.ts';
import { issueTitle, type ReviewComment } from '../src/logic/review.ts';
import { fakeSession } from './fixtures/background.ts';
import { range } from './fixtures/ranges.ts';

// The page script's messages go to the real handlers, over a review store this file can read.
const state = vi.hoisted(() => ({ reviews: undefined as unknown, sent: [] as string[] }));
vi.mock('../src/shared/messages.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/shared/messages.ts')>()),
  send: async (type: string, req: object) => {
    state.sent.push(type);
    const { createHandlers } = await import('../src/background/handlers.ts');
    const { deps } = await import('./fixtures/background.ts');
    return createHandlers(deps({ reviews: state.reviews as ReviewStore })).handle({ type, ...req }, {} as chrome.runtime.MessageSender);
  },
}));

const PAGE = `<h3 id="main-fetch"><span class="secno">4.2. </span>Main fetch</h3>
<div class="algorithm" data-algorithm="main fetch">
<p>To <dfn id="concept-main-fetch">main fetch</dfn>, run these steps:</p>
<ol><li><p>Let request be x.</p></li><li><p>If y:</p><ol><li><p>Return z.</p></li></ol></li></ol></div>`;

class FakeHighlight {
  ranges: Range[];
  constructor(...ranges: Range[]) {
    this.ranges = ranges;
  }
}

let highlights: Map<string, FakeHighlight>;
let store: ReviewStore;
let layer: ReviewLayer | undefined;
const here = () => document.URL.split('#')[0];

function commentOn(r: Range, over: Partial<ReviewComment> = {}): ReviewComment {
  const q = quoteOf(new PageText(document.body), r)!;
  return {
    id: 'c1', kind: 'comment', title: '', text: 'x', url: here(), quote: q.quote, context: q.context,
    excerpt: q.quote.exact, where: whereOf(r), position: q.position, created: 1, updated: 1, ...over,
  };
}

beforeEach(() => {
  store = new ReviewStore(fakeSession(), () => 7);
  state.reviews = store;
  state.sent = [];
  highlights = new Map();
  Object.defineProperty(window, 'CSS', { value: { highlights }, configurable: true });
  Object.defineProperty(window, 'Highlight', { value: FakeHighlight, configurable: true });
  Element.prototype.scrollIntoView = vi.fn();
  document.getSelection()?.removeAllRanges();
  document.head.innerHTML = '';
  document.body.innerHTML = PAGE;
});

afterEach(() => {
  layer?.stop();
  layer = undefined;
  vi.useRealTimers();
});

describe('ReviewLayer: highlights', () => {
  it("highlights each comment made on this page in its kind's color", async () => {
    await store.save('fetch', 'Fetch Standard', commentOn(range('Return', 'z.'), { id: 'a', kind: 'major' }));
    await store.save('fetch', 'Fetch Standard', commentOn(range('Let', 'x.'), { id: 'b' }));
    await store.save('fetch', 'Fetch Standard', { ...commentOn(range('If', 'y:'), { id: 'c' }), url: 'https://fetch.spec.whatwg.org/other.html' });
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    expect(highlights.get('wsc-review-major')!.ranges.map(String)).toEqual(['Return z.']);
    expect(highlights.get('wsc-review-comment')!.ranges.map(String)).toEqual(['Let request be x.']);
    expect(highlights.has('wsc-review-nit')).toBe(false);
    expect(document.head.querySelector('style[data-wsc-review="style"]')!.textContent).toContain('::highlight(wsc-review-major)');
    expect(layer.missing()).toEqual([]);
  });

  it("reports the comments it can't find, and follows the review as it changes", async () => {
    const gone = { ...commentOn(range('Return', 'z.'), { id: 'g' }), quote: { exact: 'Return nothing.', prefix: '', suffix: '' } };
    const review = await store.save('fetch', 'Fetch Standard', gone);
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    expect(layer.missing()).toEqual(['g']);
    layer.update({ ...review, comments: [commentOn(range('Return', 'z.'), { id: 'k', kind: 'nit' })] });
    expect(layer.missing()).toEqual([]);
    expect(highlights.get('wsc-review-nit')!.ranges.map(String)).toEqual(['Return z.']);
    layer.update(null);
    expect(highlights.has('wsc-review-nit')).toBe(false);
  });

  it('shows a comment: scrolls to it, and flashes its highlight', async () => {
    await store.save('fetch', 'Fetch Standard', commentOn(range('Return', 'z.'), { id: 'a' }));
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    vi.useFakeTimers();
    expect(layer.show('a')).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(highlights.get('wsc-review-flash')!.ranges.map(String)).toEqual(['Return z.']);
    vi.advanceTimersByTime(1500);
    expect(highlights.has('wsc-review-flash')).toBe(false);
    expect(layer.show('nope')).toBe(false);
  });

  it('works without the highlight API', async () => {
    Object.defineProperty(window, 'CSS', { value: {}, configurable: true });
    await store.save('fetch', 'Fetch Standard', commentOn(range('Return', 'z.'), { id: 'a' }));
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    expect(layer.missing()).toEqual([]);
    expect(layer.show('a')).toBe(true);
    expect(document.head.querySelector('style[data-wsc-review]')).toBeNull();
  });
});

const host = (kind: 'button' | 'editor') => document.querySelector<HTMLElement>(`[data-wsc-review="${kind}"]`);
const inside = (kind: 'button' | 'editor') => host(kind)!.shadowRoot!;
const buttonNamed = (root: ParentNode, name: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent === name)!;

function select(r: Range) {
  const s = document.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
  document.dispatchEvent(new Event('selectionchange'));
}

function type(values: { kind?: string; title?: string; text?: string }) {
  const ed = inside('editor');
  if (values.kind) ed.querySelector<HTMLInputElement>(`input[value="${values.kind}"]`)!.click();
  for (const [selector, value] of [['input[aria-label="Title"]', values.title], ['textarea', values.text]] as const) {
    if (value === undefined) continue;
    const field = ed.querySelector<HTMLInputElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }
}

const savedComments = async () => (await store.get('fetch'))?.comments ?? [];

describe('ReviewLayer: commenting', () => {
  it("shows the Comment button beside a selection, but not for a collapsed one, a form field's, or the extension's own", async () => {
    document.body.insertAdjacentHTML('beforeend', '<textarea>Some text</textarea><div data-wsc-popover="">Popover text</div>');
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    select(range('Return', 'z.'));
    expect(host('button')!.hidden).toBe(false);
    const button = inside('button').querySelector('button')!;
    expect([button.textContent, button.getAttribute('aria-label')]).toEqual(['Comment', 'Comment on the selected text']);
    const collapsed = range('Return', 'z.');
    collapsed.collapse(true);
    select(collapsed);
    expect(host('button')!.hidden).toBe(true);
    for (const el of [document.querySelector('textarea')!, document.querySelector('[data-wsc-popover]')!]) {
      const r = document.createRange();
      r.selectNodeContents(el);
      select(r);
      expect(host('button')!.hidden).toBe(true);
    }
  });

  it('saves a comment with its quote, excerpt, location, and kind, and highlights it', async () => {
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    select(range('Return', 'z.'));
    inside('button').querySelector('button')!.click();
    expect(inside('editor').querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe('Comment on 4.2. Main fetch, step 2.1');
    type({ kind: 'nit', title: 'Typo', text: 'z is never defined.' });
    buttonNamed(inside('editor'), 'Save').click();
    await vi.waitFor(async () => expect(await savedComments()).toHaveLength(1));
    expect((await savedComments())[0]).toMatchObject({
      kind: 'nit', title: 'Typo', text: 'z is never defined.', excerpt: 'Return z.', url: here(),
      quote: { exact: 'Return z.' }, where: { step: '2.1', anchor: 'concept-main-fetch' },
    });
    expect(host('editor')).toBeNull();
    await vi.waitFor(() => expect(highlights.get('wsc-review-nit')!.ranges.map(String)).toEqual(['Return z.']));
  });

  it("quotes a selection of steps with the steps' numbers", async () => {
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    select(range('Let', 'z.'));
    expect(layer.openEditor()).toBe(true);
    type({ text: 'x' });
    buttonNamed(inside('editor'), 'Save').click();
    await vi.waitFor(async () => expect(await savedComments()).toHaveLength(1));
    expect((await savedComments())[0].excerpt).toBe('1. Let request be x.\n2. If y:\n    1. Return z.');
  });

  it('cancels with Escape, saves with Ctrl+Enter, and stays open on a click elsewhere', async () => {
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    select(range('Return', 'z.'));
    layer.openEditor();
    document.body.click();
    expect(host('editor')).not.toBeNull();
    inside('editor').querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(host('editor')).toBeNull();
    select(range('Return', 'z.'));
    layer.openEditor();
    type({ text: 'Saved by keyboard.' });
    inside('editor').querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, composed: true }));
    await vi.waitFor(async () => expect((await savedComments()).map((c) => c.text)).toEqual(['Saved by keyboard.']));
  });

  it('opens the editor from the command only when text is selected', async () => {
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    expect(layer.openEditor()).toBe(false);
    expect(host('editor')).toBeNull();
    select(range('Return', 'z.'));
    expect(layer.openEditor()).toBe(true);
    expect(host('editor')).not.toBeNull();
  });

  it('opens a comment again from a click on its highlight, to edit or delete it', async () => {
    await store.save('fetch', 'Fetch Standard', commentOn(range('Return', 'z.'), { id: 'a', text: 'Old.' }));
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    const node = range('Return', 'z.').startContainer;
    Object.defineProperty(document, 'caretPositionFromPoint', { value: () => ({ offsetNode: node, offset: 2 }), configurable: true });
    node.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));
    expect(inside('editor').querySelector('textarea')!.value).toBe('Old.');
    buttonNamed(inside('editor'), 'Delete').click();
    await vi.waitFor(async () => expect(await store.get('fetch')).toBeUndefined());
    expect(layer.edit('a')).toBe(false);
  });

  it('files a comment as a new issue, and puts one too long for its link on the clipboard', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    select(range('Return', 'z.'));
    layer.openEditor();
    type({ text: 'Short.' });
    buttonNamed(inside('editor'), 'File issue').click();
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/github\.com\/whatwg\/fetch\/issues\/new\?title=Short\.&body=In%20%5B4\.2\.%20Main%20fetch/),
      '_blank',
      'noopener',
    );
    expect(writeText).not.toHaveBeenCalled();
    await vi.waitFor(async () => expect((await savedComments())[0].filed).toBe(7));
    select(range('Let', 'x.'));
    layer.openEditor();
    type({ text: 'y'.repeat(9000) });
    buttonNamed(inside('editor'), 'File issue').click();
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^In \[4\.2\. Main fetch, step 1\]/));
    const title = issueTitle({ ...(await savedComments())[0], text: 'y'.repeat(9000) });
    expect(open).toHaveBeenLastCalledWith(`https://github.com/whatwg/fetch/issues/new?title=${encodeURIComponent(title)}`, '_blank', 'noopener');
    await vi.waitFor(() => expect(inside('editor').textContent).toContain('The issue text is on your clipboard: Paste it into the issue.'));
    open.mockRestore();
  });

  it('hides the button while the setting is off', async () => {
    layer = new ReviewLayer(document, { shortname: 'fetch', button: false });
    await layer.start();
    select(range('Return', 'z.'));
    expect(host('button')?.hidden ?? true).toBe(true);
    layer.setButton(true);
    select(range('Return', 'z.'));
    expect(host('button')!.hidden).toBe(false);
  });
});

describe('ReviewLayer: big and changing pages', () => {
  it('places the button without measuring or reading out the whole selection', async () => {
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    const measured: boolean[] = [];
    const rects = vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
      measured.push(this.collapsed);
      return [] as unknown as DOMRectList;
    });
    const text = vi.spyOn(Range.prototype, 'toString');
    select(range('Let', 'z.'));
    expect(host('button')!.hidden).toBe(false);
    expect(measured.length > 0 && measured.every(Boolean)).toBe(true);
    expect(text).not.toHaveBeenCalled();
    rects.mockRestore();
    text.mockRestore();
  });

  it('quotes text the page changed after the extension first read the page', async () => {
    await store.save('fetch', 'Fetch Standard', commentOn(range('Return', 'z.'), { id: 'a' }));
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    (range('Let', 'x.').startContainer as Text).data = 'Let request be extra.';
    select(range('extra', 'extra.'));
    layer.openEditor();
    type({ text: 'x' });
    buttonNamed(inside('editor'), 'Save').click();
    await vi.waitFor(async () => expect(await savedComments()).toHaveLength(2));
    expect((await savedComments())[1].quote.exact).toBe('extra.');
  });
});

describe('ReviewLayer: the side panel', () => {
  it('tells the side panel each time it has placed the review', async () => {
    layer = new ReviewLayer(document, { shortname: 'fetch' });
    await layer.start();
    await vi.waitFor(() => expect(state.sent).toContain('review-placed'));
  });
});
