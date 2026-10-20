import { describe, it, expect } from 'vitest';
import {
  commentMarkdown, isComment, isReview, issueLink, issueTitle, MAX_ISSUE_URL, quoteLink, reviewMarkdown, reviewTitle,
  sortComments, whereLabel, type Review, type ReviewComment,
} from '../src/logic/review.ts';

const FETCH = 'https://fetch.spec.whatwg.org/';
const comment = (over: Partial<ReviewComment> = {}): ReviewComment => ({
  id: 'c1',
  kind: 'comment',
  title: '',
  text: 'This never says what happens to a redirect.',
  url: FETCH,
  quote: { exact: 'If request\u2019s response tainting is "cors", then', prefix: 'Otherwise, if ', suffix: ' set response' },
  excerpt: 'If request\u2019s response tainting is "cors", then:',
  context: { before: 'Otherwise, if', after: 'set response' },
  where: { section: { id: 'main-fetch', number: '4.2', title: 'Main fetch' }, step: '5.2', anchor: 'main-fetch' },
  position: 100,
  created: 1,
  updated: 1,
  ...over,
});
const review = (comments: ReviewComment[]): Review => ({ shortname: 'fetch', title: 'Fetch Standard', comments });

describe('whereLabel', () => {
  it('names the section by its number and title, then the step', () => {
    expect(whereLabel(comment().where, 'Fetch Standard')).toBe('4.2. Main fetch, step 5.2');
    expect(whereLabel({ section: { title: 'Introduction' } }, 'Fetch Standard')).toBe('Introduction');
  });

  it("adds the algorithm when it isn't the section's own name", () => {
    const section = { number: '4.6', title: 'HTTP fetch' };
    expect(whereLabel({ section, step: '3', algorithm: 'HTTP-network-or-cache fetch' }, 'x')).toBe(
      '4.6. HTTP fetch, step 3 of HTTP-network-or-cache fetch',
    );
    expect(whereLabel({ section: { number: '4.2', title: 'Main fetch' }, step: '1', algorithm: 'main fetch' }, 'x')).toBe(
      '4.2. Main fetch, step 1',
    );
  });

  it('falls back to the spec title outside any section', () => {
    expect(whereLabel({}, 'Fetch Standard')).toBe('Fetch Standard');
    expect(whereLabel({ step: '2' }, 'Fetch Standard')).toBe('Fetch Standard, step 2');
  });
});

describe('quoteLink', () => {
  it('links to the quoted words, with the words around them', () => {
    expect(quoteLink(comment())).toBe(
      'https://fetch.spec.whatwg.org/#main-fetch:~:text=Otherwise%2C%20if-,If%20request%E2%80%99s%20response%20tainting%20is%20%22cors%22%2C%20then,-set%20response',
    );
  });

  it('gives a long quote by its first and last words, and encodes the hyphens the directive reserves', () => {
    const exact = 'Let response be the result of running HTTP-network fetch given fetchParams';
    const c = comment({ quote: { exact, prefix: '', suffix: '' }, context: {}, where: {} });
    expect(quoteLink(c)).toBe('https://fetch.spec.whatwg.org/#:~:text=Let%20response%20be%20the,HTTP%2Dnetwork%20fetch%20given%20fetchParams');
  });

  it('encodes an ampersand, and the anchor', () => {
    const c = comment({ quote: { exact: 'A & B', prefix: '', suffix: '' }, context: {}, where: { anchor: 'x y' } });
    expect(quoteLink(c)).toBe('https://fetch.spec.whatwg.org/#x%20y:~:text=A%20%26%20B');
  });
});

describe('commentMarkdown', () => {
  it('leads with the linked location, quotes the excerpt, then gives the comment', () => {
    expect(commentMarkdown(comment(), 'Fetch Standard')).toBe(
      `In [4.2. Main fetch, step 5.2](${quoteLink(comment())}):\n\n> If request\u2019s response tainting is "cors", then:\n\nThis never says what happens to a redirect.`,
    );
  });

  it('quotes each line of an excerpt, and leaves out an empty comment', () => {
    const c = comment({ excerpt: '1. Let x be 1.\n\n    2. Return x.', text: '' });
    expect(commentMarkdown(c, 'Fetch Standard').split('\n\n').slice(1)).toEqual(['> 1. Let x be 1.\n>\n>     2. Return x.']);
  });
});

describe('reviewMarkdown', () => {
  it('groups the comments by kind, major issues first, with a heading for each comment', () => {
    const nit = comment({ id: 'n', kind: 'nit', title: 'Typo', text: 'teh', position: 5 });
    const major1 = comment({ id: 'm1', kind: 'major', title: 'Redirects', position: 50 });
    const major2 = comment({ id: 'm2', kind: 'major', text: 'And CORS.', position: 10, where: { section: { number: '3', title: 'CORS' } } });
    const md = reviewMarkdown(review([nit, major1, major2]));
    expect(md.split('\n').filter((line) => line.startsWith('#'))).toEqual([
      '# Review of Fetch Standard',
      '## Major issues',
      '### 3. CORS',
      '### Redirects',
      '## Nit',
      '### Typo',
    ]);
    expect(md).toContain(`### Typo\n\n${commentMarkdown(nit, 'Fetch Standard')}`);
  });
});

describe('sortComments', () => {
  it('orders by kind, then page, then position, then when each was made', () => {
    const page = (name: string) => `https://html.spec.whatwg.org/multipage/${name}.html`;
    const a = comment({ id: 'a', kind: 'nit' });
    const b = comment({ id: 'b', kind: 'major', url: page('b') });
    const c = comment({ id: 'c', kind: 'major', url: page('a'), position: 900 });
    const d = comment({ id: 'd', kind: 'major', url: page('a'), position: 4, created: 2 });
    const e = comment({ id: 'e', kind: 'major', url: page('a'), position: 4, created: 1 });
    expect(sortComments([a, b, c, d, e]).map((x) => x.id)).toEqual(['e', 'd', 'c', 'b', 'a']);
  });
});

describe('issues', () => {
  it("titles an issue by the comment's title, or else its first line, with a prefix where the repository wants one", () => {
    expect(issueTitle(comment({ title: 'Redirects' }))).toBe('Redirects');
    expect(issueTitle(comment({ text: 'First line.\nSecond line.' }))).toBe('First line.');
    expect(issueTitle(comment({ text: 'word '.repeat(30).trim() }))).toBe(`${'word '.repeat(16).trim()}\u2026`);
    expect(issueTitle(comment({ title: '', text: '' }), undefined, 'Fetch Standard')).toBe('4.2. Main fetch, step 5.2');
    const css = { repo: 'https://github.com/w3c/csswg-drafts', prefix: '[css-grid-3]' };
    expect(issueTitle(comment({ title: 'Redirects' }), css)).toBe('[css-grid-3] Redirects');
    expect(reviewTitle(review([]), { repo: 'https://github.com/whatwg/fetch' })).toBe('Review of Fetch Standard');
    expect(reviewTitle(review([]), css)).toBe('[css-grid-3] Review of Fetch Standard');
  });

  it('puts the title and body in a new-issue link, and leaves out a body too long for one', () => {
    const target = { repo: 'https://github.com/whatwg/fetch' };
    expect(issueLink(target, 'Redirects', 'Hello there & more')).toEqual({
      url: 'https://github.com/whatwg/fetch/issues/new?title=Redirects&body=Hello%20there%20%26%20more',
      tooLong: false,
    });
    expect(issueLink(target, 'Redirects', 'x'.repeat(MAX_ISSUE_URL))).toEqual({
      url: 'https://github.com/whatwg/fetch/issues/new?title=Redirects',
      tooLong: true,
    });
  });
});

describe('validation', () => {
  it('accepts only comments and reviews of the right shape', () => {
    expect(isComment(comment())).toBe(true);
    expect(isComment({ ...comment(), kind: 'blocker' })).toBe(false);
    expect(isComment({ ...comment(), position: '3' })).toBe(false);
    expect(isComment({ ...comment(), quote: { exact: 'x' } })).toBe(false);
    expect(isComment({ ...comment(), filed: 'yesterday' })).toBe(false);
    expect(isReview(review([comment()]))).toBe(true);
    expect(isReview({ ...review([comment()]), comments: [comment(), { id: 'x' }] })).toBe(false);
    expect(isReview(null)).toBe(false);
  });

  it('checks the fields inside where and context too', () => {
    expect(isComment({ ...comment(), where: { algorithm: 7 } })).toBe(false);
    expect(isComment({ ...comment(), where: { section: { number: '1' } } })).toBe(false);
    expect(isComment({ ...comment(), where: { step: ['2'] } })).toBe(false);
    expect(isComment({ ...comment(), context: { before: 3 } })).toBe(false);
    expect(isComment({ ...comment(), where: {}, context: {} })).toBe(true);
  });
});
