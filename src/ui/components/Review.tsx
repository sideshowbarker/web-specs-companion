import { useEffect, useState } from 'preact/hooks';
import {
  commentMarkdown, issueLink, issueTitle, KIND_NAMES, quoteLink, reviewMarkdown, reviewTitle, sortComments, whereLabel,
  type IssueTarget, type Review, type ReviewComment,
} from '../../logic/review.ts';
import { copyText, navigate, onReviewChanged, onReviewPlaced, open, send, sendToTab } from '../api.ts';
import { formatDate } from '../format.ts';

const CLIPBOARD_NOTE = 'The issue text is on your clipboard: Paste it into the issue.';

interface State {
  review: Review | null;
  title: string;
  target: IssueTarget | null;
  missing: string[];
}

// A failed message, or a page with no page script to answer, reads as no answer.
const quietly = <T,>(ask: () => Promise<T>): Promise<T | undefined> => {
  try {
    return Promise.resolve(ask()).catch(() => undefined);
  } catch {
    return Promise.resolve(undefined);
  }
};

const firstLine = (c: ReviewComment) => c.text.trim().split('\n')[0];
const pad = (n: number) => String(n).padStart(2, '0');
// The day a comment was filed, where the reader is.
const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// The spec's review: its comments, what became of each, and the review's own actions.
export function ReviewBlock({ tabId, shortname, url }: { tabId: number; shortname: string; url: string }) {
  const [state, setState] = useState<State>();
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const page = url.split('#')[0];

  async function load() {
    const [answer, status] = await Promise.all([
      quietly(() => send('get-review', { shortname, tabId })),
      quietly(() => sendToTab(tabId, 'review-status', {})),
    ]);
    setState({
      review: answer?.review ?? null,
      title: answer?.title ?? '',
      target: answer?.target ?? null,
      missing: status?.missing ?? [],
    });
  }

  useEffect(() => {
    load();
    const stops = [onReviewChanged(shortname, () => load()), onReviewPlaced(tabId, () => load())];
    return () => stops.forEach((stop) => stop());
  }, [shortname, tabId, page]);

  if (!state) return null;
  const { review, title, target, missing } = state;
  const comments = sortComments(review?.comments ?? []);
  const count = comments.length;

  // Opens a new issue, its body on the clipboard when it's too long for the link, and records what was filed.
  function fileIssue(issue: string, body: string, ids: string[]) {
    if (!target) return;
    const { url: link, tooLong } = issueLink(target, issue, body);
    if (tooLong) {
      copyText(body).catch(() => {});
      setNote(CLIPBOARD_NOTE);
    }
    open(link);
    quietly(() => send('mark-filed', { shortname, ids })).then(load);
  }

  function show(c: ReviewComment) {
    if (c.url === page) quietly(() => sendToTab(tabId, 'show-comment', { id: c.id }));
    else navigate(tabId, quoteLink(c));
  }

  const copyReview = () => copyText(reviewMarkdown(review!)).then(() => setNote('Copied the review.'), () => {});
  const fileReview = () =>
    target && fileIssue(reviewTitle(review!, target), reviewMarkdown(review!), comments.map((c) => c.id));
  const deleteReview = () => {
    setConfirming(false);
    quietly(() => send('delete-review', { shortname })).then(load);
  };

  if (count === 0) {
    return (
      <div class="review">
        <h3>Your review</h3>
        <p class="muted">Select text in the spec, and choose Comment to start a review.</p>
      </div>
    );
  }

  return (
    <div class="review">
      <h3>{`Your review: ${count} ${plural(count, 'comment', 'comments')}`}</h3>
      <ol class="comments">
        {comments.map((c) => {
          const label = whereLabel(c.where, title);
          const gone = missing.includes(c.id);
          const filed = c.filed === undefined ? undefined : formatDate(localDay(c.filed));
          const edit = () => quietly(() => sendToTab(tabId, 'edit-comment', { id: c.id }));
          const file = () => target && fileIssue(issueTitle(c, target, title), commentMarkdown(c, title), [c.id]);
          const remove = () => quietly(() => send('delete-comment', { shortname, id: c.id })).then(load);
          return (
            <li key={c.id}>
              <p>
                <span class={`kind kind-${c.kind}`}>{KIND_NAMES[c.kind].one}</span>{' '}
                <strong>{c.title.trim() || firstLine(c)}</strong>
              </p>
              <p class="muted">{label}</p>
              {filed && <p class="muted">Filed as an issue on {filed}</p>}
              {gone && <p class="warn">Not found in this version of the page</p>}
              <p class="review-actions">
                <button type="button" aria-label={`Show the comment on ${label}`} onClick={() => show(c)}>Show</button>
                {c.url === page && !gone && (
                  <button type="button" aria-label={`Edit the comment on ${label}`} onClick={edit}>Edit</button>
                )}
                {target && (
                  <button type="button" aria-label={`File the comment on ${label} as an issue`} onClick={file}>
                    File issue
                  </button>
                )}
                <button type="button" aria-label={`Delete the comment on ${label}`} onClick={remove}>Delete</button>
              </p>
            </li>
          );
        })}
      </ol>
      <p class="review-actions">
        <button type="button" onClick={copyReview}>Copy review</button>
        {target && <button type="button" onClick={fileReview}>File review as one issue</button>}
        {confirming ? (
          <>
            <button type="button" onClick={deleteReview}>
              {count === 1 ? 'Delete the comment' : `Delete all ${count} comments`}
            </button>
            <button type="button" onClick={() => setConfirming(false)}>Keep them</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>Delete review</button>
        )}
      </p>
      <p class="muted" aria-live="polite">{note}</p>
    </div>
  );
}
