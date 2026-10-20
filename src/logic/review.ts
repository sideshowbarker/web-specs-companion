// A spec review: Comments on quotes from a spec, and what they become when copied or filed. That's Markdown that links
// each quote's location to the quoted words with a text fragment, and GitHub new-issue links.

export type Kind = 'major' | 'minor' | 'comment' | 'nit';

export const KINDS: readonly Kind[] = ['major', 'minor', 'comment', 'nit'];

export const KIND_NAMES: Record<Kind, { one: string; many: string }> = {
  major: { one: 'Major issue', many: 'Major issues' },
  minor: { one: 'Minor issue', many: 'Minor issues' },
  comment: { one: 'Comment', many: 'Comments' },
  nit: { one: 'Nit', many: 'Nits' },
};

// A TextQuoteSelector, as the Web Annotation Data Model defines one: the quoted text, and the text on either side.
// https://www.w3.org/TR/annotation-model/#text-quote-selector
export interface Quote {
  exact: string;
  prefix: string;
  suffix: string;
}

export interface Where {
  section?: { id?: string; number?: string; title: string };
  step?: string;
  algorithm?: string;
  anchor?: string;
}

export interface ReviewComment {
  id: string;
  kind: Kind;
  title: string;
  // The reviewer's words, in Markdown.
  text: string;
  // The page the comment was made on, without its fragment.
  url: string;
  quote: Quote;
  // The quote as it reads on the page: The steps with their numbers, when the selection covers several steps.
  excerpt: string;
  // The words around the quote in its own block, for its text-fragment link.
  context?: { before?: string; after?: string };
  where: Where;
  // The quote's offset in the page's text, for ordering.
  position: number;
  created: number;
  updated: number;
  // When "File issue" last opened an issue for it.
  filed?: number;
}

export interface Review {
  shortname: string;
  title: string;
  comments: ReviewComment[];
}

export interface IssueTarget {
  repo: string;
  // Goes in front of an issue's title, for a repository that holds more than one series of specs.
  prefix?: string;
}

// GitHub fails a new-issue URL much longer than this.
export const MAX_ISSUE_URL = 8000;

const TITLE_LENGTH = 80;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const isOptional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);

function isWhere(v: unknown): v is Where {
  if (!isObject(v)) return false;
  const isSection = (s: unknown) =>
    isObject(s) && isString(s.title) && isOptional(s.id, isString) && isOptional(s.number, isString);
  return isOptional(v.section, isSection) && ['step', 'algorithm', 'anchor'].every((k) => isOptional(v[k], isString));
}

const isContext = (v: unknown) => isObject(v) && isOptional(v.before, isString) && isOptional(v.after, isString);

export function isComment(v: unknown): v is ReviewComment {
  if (!isObject(v)) return false;
  const { quote, where, context, filed } = v;
  return (
    ['id', 'title', 'text', 'url', 'excerpt'].every((k) => isString(v[k]))
    && KINDS.includes(v.kind as Kind)
    && isObject(quote) && isString(quote.exact) && isString(quote.prefix) && isString(quote.suffix)
    && isWhere(where)
    && isOptional(context, isContext)
    && ['position', 'created', 'updated'].every((k) => isNumber(v[k]))
    && isOptional(filed, isNumber)
  );
}

export function isReview(v: unknown): v is Review {
  return isObject(v) && isString(v.shortname) && isString(v.title)
    && Array.isArray(v.comments) && v.comments.every(isComment);
}

export function sortComments(comments: readonly ReviewComment[]): ReviewComment[] {
  return [...comments].sort(
    (a, b) =>
      KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)
      || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)
      || a.position - b.position
      || a.created - b.created,
  );
}

// Where a comment is, as its spec numbers it: "4.2. Main fetch, step 5.2". A step's algorithm is named only when it
// isn't the section's own name.
export function whereLabel(where: Where, specTitle: string): string {
  const { section, step, algorithm } = where;
  let label = section ? (section.number ? `${section.number}. ${section.title}` : section.title) : specTitle;
  if (step) {
    label += `, step ${step}`;
    if (algorithm && algorithm.toLowerCase() !== section?.title.toLowerCase()) label += ` of ${algorithm}`;
  }
  return label;
}

// A text directive's terms are percent-encoded, and so are the characters its syntax reserves: "-", ",", and "&".
// https://wicg.github.io/scroll-to-text-fragment/#syntax
const term = (s: string) => encodeURIComponent(s).replace(/-/g, '%2D');

// A link to the quoted words themselves, by a text directive after the nearest anchor, so a browser that can't find
// the words, or doesn't know text directives, still scrolls to the anchor.
export function quoteLink(c: ReviewComment): string {
  const words = c.quote.exact.split(' ').filter(Boolean);
  const parts = words.length <= 8
    ? [term(words.join(' '))]
    : [term(words.slice(0, 4).join(' ')), term(words.slice(-4).join(' '))];
  if (c.context?.before) parts.unshift(`${term(c.context.before)}-`);
  if (c.context?.after) parts.push(`-${term(c.context.after)}`);
  return `${c.url}#${c.where.anchor ? encodeURIComponent(c.where.anchor) : ''}:~:text=${parts.join(',')}`;
}

export function commentMarkdown(c: ReviewComment, specTitle: string): string {
  const quote = c.excerpt.split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n');
  const parts = [`In [${whereLabel(c.where, specTitle)}](${quoteLink(c)}):`, quote];
  if (c.text.trim()) parts.push(c.text.trim());
  return parts.join('\n\n');
}

// The whole review, in the shape ietf-comments uses: one h1, an h2 for each kind of comment, and an h3 for each one.
// https://github.com/mnot/ietf-comments/blob/main/format.md
export function reviewMarkdown(review: Review): string {
  const parts = [`# Review of ${review.title}`];
  const sorted = sortComments(review.comments);
  for (const kind of KINDS) {
    const ofKind = sorted.filter((c) => c.kind === kind);
    if (ofKind.length === 0) continue;
    parts.push(`## ${ofKind.length === 1 ? KIND_NAMES[kind].one : KIND_NAMES[kind].many}`);
    for (const c of ofKind) {
      parts.push(`### ${c.title.trim() || whereLabel(c.where, review.title)}`, commentMarkdown(c, review.title));
    }
  }
  return parts.join('\n\n');
}

// A title of at most 80 characters, cut after a whole word where it can be.
function shorten(title: string): string {
  if (title.length <= TITLE_LENGTH) return title;
  let out = '';
  for (const word of title.split(' ')) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > TITLE_LENGTH - 1) break;
    out = next;
  }
  return `${out || title.slice(0, TITLE_LENGTH - 1)}\u2026`;
}

const withPrefix = (title: string, target?: IssueTarget) => (target?.prefix ? `${target.prefix} ${title}` : title);

export function issueTitle(c: ReviewComment, target?: IssueTarget, specTitle = ''): string {
  const own = c.title.trim() || c.text.trim().split('\n')[0].trim() || whereLabel(c.where, specTitle);
  return withPrefix(shorten(own), target);
}

export function reviewTitle(review: Review, target?: IssueTarget): string {
  return withPrefix(`Review of ${review.title}`, target);
}

// A new-issue link with the title and body filled in, which GitHub honors even where issues come only through a form.
// One too long for a URL leaves the body out, for the caller to put on the clipboard instead.
export function issueLink(target: IssueTarget, title: string, body: string): { url: string; tooLong: boolean } {
  const base = `${target.repo}/issues/new?title=${encodeURIComponent(title)}`;
  const url = `${base}&body=${encodeURIComponent(body)}`;
  return url.length > MAX_ISSUE_URL ? { url: base, tooLong: true } : { url, tooLong: false };
}
