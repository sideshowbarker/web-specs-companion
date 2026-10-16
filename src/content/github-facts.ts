import type { PageFacts } from '../shared/types.ts';
import { parseGitHubUrl } from '../shared/url.ts';

export function readGitHubFacts(doc: Document, url: string): PageFacts {
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || undefined;
  const parsed = parseGitHubUrl(url);
  const nwo = meta('octolytics-dimension-repository_nwo') ?? parsed?.nwo;
  return {
    kind: 'github',
    url,
    github: nwo ? { nwo, route: meta('route-pattern'), number: parsed?.number } : undefined,
  };
}

// GitHub navigates without page loads, so the content script runs once per tab, not once per page. Watch its
// render events, and poll as a backstop for when its event names change.
export function watchNavigation(win: Window, doc: Document, onChange: (url: string) => void, pollMs = 1_000): () => void {
  let last = win.location.href;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    pending = undefined;
    if (win.location.href === last) return;
    last = win.location.href;
    onChange(last);
  };
  // Meta tags update a moment after the URL does.
  const soon = () => {
    if (pending === undefined) pending = setTimeout(check, 300);
  };
  const events = ['turbo:render', 'soft-nav:end', 'soft-nav:react-done', 'pjax:end'];
  for (const e of events) doc.addEventListener(e, soon);
  win.addEventListener('popstate', soon);
  const poll = setInterval(check, pollMs);
  return () => {
    for (const e of events) doc.removeEventListener(e, soon);
    win.removeEventListener('popstate', soon);
    clearInterval(poll);
    if (pending !== undefined) clearTimeout(pending);
  };
}
