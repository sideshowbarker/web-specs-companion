// Runs on spec pages at document_idle in the isolated world, as declared by the manifest's run_at and world keys:
// https://w3c.github.io/webextensions/specification/#key-run_at
import '../shared/browser.ts';
import { isReview } from '../logic/review.ts';
import { send } from '../shared/messages.ts';
import { getSettings, onSettingsChanged } from '../shared/settings.ts';
import { extractSpecFacts, whenSpecReady } from './extract.ts';
import { clearProblems, collectOutboundLinks, markProblems, revealLink } from './links.ts';
import { ReviewLayer } from './review.ts';
import { copySteps } from './steps.ts';
import { UsedByLayer } from './usedby.ts';

let layer: UsedByLayer | undefined;
let review: ReviewLayer | undefined;
let currentShortname: string | undefined;
let linkElements: HTMLAnchorElement[] = [];

browser.runtime.onMessage.addListener((msg: { type?: string; i?: number; id?: string }, _sender, sendResponse) => {
  if (msg.type === 'run-link-check') {
    if (!currentShortname) {
      sendResponse({ error: 'This page isn\u2019t a spec the extension knows.' });
      return false;
    }
    clearProblems(document);
    const { links, elements } = collectOutboundLinks(document, location.href);
    linkElements = elements;
    send('check-links', { shortname: currentShortname, links }).then(
      (result) => {
        markProblems(document, linkElements, result.problems);
        sendResponse(result);
      },
      (err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }),
    );
    return true;
  }
  if (msg.type === 'reveal-link' && typeof msg.i === 'number') {
    sendResponse({ ok: revealLink(linkElements, msg.i) });
    return false;
  }
  if (msg.type === 'clear-link-check') {
    clearProblems(document);
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'show-comment' && typeof msg.id === 'string') {
    sendResponse({ ok: review?.show(msg.id) ?? false });
    return false;
  }
  if (msg.type === 'review-status') {
    sendResponse({ missing: review?.missing() ?? [] });
    return false;
  }
  if (msg.type === 'open-comment-editor') {
    sendResponse({ ok: review?.openEditor() ?? false });
    return false;
  }
  if (msg.type === 'edit-comment' && typeof msg.id === 'string') {
    sendResponse({ ok: review?.edit(msg.id) ?? false });
    return false;
  }
  return false;
});

// A copy of steps gets their numbers on any page this runs on, whether or not it's a spec the extension knows.
document.addEventListener('copy', copySteps);

async function showUsedBy(shortname: string) {
  const { map, specdex } = await send('get-used-by', { shortname });
  if (!map || layer) return;
  layer = new UsedByLayer(document, map, { specdex });
  await layer.render();
}

// The spec's review: Its comments' highlights, following the review as it changes in storage.
function startReview(shortname: string, button: boolean) {
  review = new ReviewLayer(document, { shortname, button });
  review.start().catch((err) => console.debug('web-specs-companion:', err));
  const key = `review:${shortname}`;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[key]) return;
    const value = changes[key].newValue;
    review?.update(isReview(value) ? value : null);
  });
}

function hideUsedBy() {
  layer?.clear();
  layer = undefined;
}

async function main() {
  await whenSpecReady(document, window);
  const facts = extractSpecFacts(document, location.href);
  const { shortname } = await send('page-facts', { facts });
  currentShortname = shortname;
  if (!shortname) return;
  const settings = await getSettings();
  startReview(shortname, settings.reviewButton);
  if (settings.usedBy) await showUsedBy(shortname);
  onSettingsChanged((s) => {
    review?.setButton(s.reviewButton);
    if (s.usedBy) showUsedBy(shortname).catch(() => {});
    else hideUsedBy();
  });
}

main().catch((err) => console.debug('web-specs-companion:', err));
