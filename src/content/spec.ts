// Runs on spec pages at document_idle in the isolated world, as declared by the manifest's run_at and world keys:
// https://w3c.github.io/webextensions/specification/#key-run_at
import '../shared/browser.ts';
import { send } from '../shared/messages.ts';
import { getSettings, onSettingsChanged } from '../shared/settings.ts';
import { extractSpecFacts, whenSpecReady } from './extract.ts';
import { clearProblems, collectOutboundLinks, markProblems, revealLink } from './links.ts';
import { UsedByLayer } from './usedby.ts';

let layer: UsedByLayer | undefined;
let currentShortname: string | undefined;
let linkElements: HTMLAnchorElement[] = [];

browser.runtime.onMessage.addListener((msg: { type?: string; i?: number }, _sender, sendResponse) => {
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
  return false;
});

async function showUsedBy(shortname: string) {
  const { map, specdex } = await send('get-used-by', { shortname });
  if (!map || layer) return;
  layer = new UsedByLayer(document, map, { specdex });
  await layer.render();
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
  if ((await getSettings()).usedBy) await showUsedBy(shortname);
  onSettingsChanged((s) => {
    if (s.usedBy) showUsedBy(shortname).catch(() => {});
    else hideUsedBy();
  });
}

main().catch((err) => console.debug('w3c-companion:', err));
