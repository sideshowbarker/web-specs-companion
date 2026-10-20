import { describe, it, expect } from 'vitest';
import { ReviewStore } from '../src/background/reviews.ts';
import type { ReviewComment } from '../src/logic/review.ts';
import { fakeSession } from './fixtures/background.ts';

const comment = (id: string, over: Partial<ReviewComment> = {}): ReviewComment => ({
  id, kind: 'comment', title: '', text: id, url: 'https://fetch.spec.whatwg.org/',
  quote: { exact: id, prefix: '', suffix: '' }, excerpt: id, where: {}, position: 0, created: 1, updated: 1, ...over,
});

describe('ReviewStore', () => {
  it('saves comments under their spec, and replaces one with the same id', async () => {
    const store = new ReviewStore(fakeSession(), () => 9);
    await store.save('fetch', 'Fetch Standard', comment('a'));
    await store.save('fetch', 'Fetch Standard', comment('b'));
    const review = await store.save('fetch', 'Fetch Standard', comment('a', { text: 'changed' }));
    expect(review).toEqual({ shortname: 'fetch', title: 'Fetch Standard', comments: [comment('a', { text: 'changed' }), comment('b')] });
    expect(await store.get('fetch')).toEqual(review);
    expect(await store.get('html')).toBeUndefined();
  });

  it('applies writes one at a time, in the order they came', async () => {
    const store = new ReviewStore(fakeSession(), () => 9);
    await Promise.all([
      store.save('fetch', 'F', comment('a')),
      store.save('fetch', 'F', comment('b')),
      store.remove('fetch', 'a'),
      store.save('fetch', 'F', comment('c')),
    ]);
    expect((await store.get('fetch'))!.comments.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it("removes a spec's entry with its last comment, and on clear", async () => {
    const area = fakeSession();
    const store = new ReviewStore(area, () => 9);
    await store.save('fetch', 'F', comment('a'));
    expect(await store.remove('fetch', 'a')).toBeUndefined();
    expect(await area.get('review:fetch')).toEqual({});
    await store.save('fetch', 'F', comment('a'));
    await store.clear('fetch');
    expect(await store.get('fetch')).toBeUndefined();
  });

  it("reads a stored review it can't make sense of as none", async () => {
    const area = fakeSession();
    await area.set({ 'review:fetch': { shortname: 'fetch', comments: [{ id: 'x' }] } });
    const store = new ReviewStore(area, () => 9);
    expect(await store.get('fetch')).toBeUndefined();
    expect((await store.save('fetch', 'F', comment('a'))).comments.map((c) => c.id)).toEqual(['a']);
  });

  it('records when comments were filed', async () => {
    const store = new ReviewStore(fakeSession(), () => 42);
    await store.save('fetch', 'F', comment('a'));
    await store.save('fetch', 'F', comment('b'));
    expect((await store.markFiled('fetch', ['b']))!.comments.map((c) => c.filed)).toEqual([undefined, 42]);
  });
});
