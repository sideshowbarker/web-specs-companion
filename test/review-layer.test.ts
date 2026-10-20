// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReviewStore } from '../src/background/reviews.ts';
import { PageText, quoteOf } from '../src/content/quote.ts';
import { ReviewLayer } from '../src/content/review.ts';
import { whereOf } from '../src/content/where.ts';
import type { ReviewComment } from '../src/logic/review.ts';
import { fakeSession } from './fixtures/background.ts';
import { range } from './fixtures/ranges.ts';

// The page script's messages go to the real handlers, over a review store this file can read.
const state = vi.hoisted(() => ({ reviews: undefined as unknown }));
vi.mock('../src/shared/messages.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/shared/messages.ts')>()),
  send: async (type: string, req: object) => {
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
