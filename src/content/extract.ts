import { RESPEC_READY } from '../shared/messages.ts';
import type { Generator, PageFacts } from '../shared/types.ts';
import { parseGroupUrl } from '../shared/url.ts';

const ED_HOST = /(^|\.)github\.io$|^drafts\.(csswg|fxtf|css-houdini)\.org$|\.spec\.whatwg\.org$|^svgwg\.org$/;

export function detectGenerator(doc: Document, url: string): Generator {
  const gen = doc.querySelector('meta[name="generator"]')?.getAttribute('content') ?? '';
  if (/bikeshed/i.test(gen)) return 'bikeshed';
  if (/respec/i.test(gen) || doc.querySelector('script#initialUserConfig, script[src*="respec"]')) return 'respec';
  if (new URL(url).hostname === 'html.spec.whatwg.org') return 'wattsi';
  return 'unknown';
}

// A live ReSpec draft renders client-side: Until it finishes, there's no header, no ids, and no ToC to read.
export function isRespecPending(doc: Document): boolean {
  if (doc.querySelector('script#initialUserConfig')) return false;
  if (/respec/i.test(doc.querySelector('meta[name="generator"]')?.getAttribute('content') ?? '')) return false;
  return !!doc.querySelector('script[src*="respec"]');
}

export function whenSpecReady(doc: Document, win: Window, timeoutMs = 20_000): Promise<void> {
  if (!isRespecPending(doc)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      win.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data === RESPEC_READY) done();
    };
    const observer = new MutationObserver(() => {
      if (!isRespecPending(doc)) done();
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    win.addEventListener('message', onMessage);
    const timer = setTimeout(done, timeoutMs);
  });
}

function respecConfig(doc: Document): Record<string, unknown> | undefined {
  const text = doc.querySelector('script#initialUserConfig')?.textContent;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isoDate(doc: Document): string | undefined {
  const t = doc.querySelector('time.dt-updated, time.dt-published')?.getAttribute('datetime') ?? undefined;
  return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : undefined;
}

export function extractSpecFacts(doc: Document, url: string): PageFacts {
  const facts: PageFacts = { kind: 'spec', url, generator: detectGenerator(doc, url) };
  const title = (doc.querySelector('h1#title, h1.p-name, h1') ?? doc.querySelector('title'))?.textContent?.trim();
  if (title) facts.title = title.replace(/\s+/g, ' ');

  const config = respecConfig(doc);
  const metaStatus = doc.querySelector('meta[name="w3c-status"]')?.getAttribute('content') ?? undefined;
  facts.status = metaStatus ?? (typeof config?.specStatus === 'string' ? config.specStatus : undefined);
  if (typeof config?.shortName === 'string') facts.shortname = config.shortName;

  const head = doc.querySelector('.head') ?? doc.querySelector('header') ?? doc.body;
  for (const a of Array.from(head?.querySelectorAll<HTMLAnchorElement>('dl a[href]') ?? [])) {
    let u: URL;
    try {
      u = new URL(a.getAttribute('href')!, url);
    } catch {
      continue;
    }
    const href = u.href;
    if (u.hostname === 'www.w3.org' && /^\/TR\/\d{4}\//.test(u.pathname)) facts.thisVersionUrl ??= href;
    else if (u.hostname === 'www.w3.org' && /^\/TR\/[^/]+\/?$/.test(u.pathname)) facts.latestUrl ??= href;
    else if (u.hostname === 'www.w3.org' && u.pathname.startsWith('/standards/history/')) facts.historyUrl ??= href;
    else if (u.hostname === 'github.com') {
      const m = /^\/([^/]+)\/([^/]+)\/?(issues\/?)?$/.exec(u.pathname);
      if (m?.[3]) facts.issuesUrl ??= href;
      if (m) facts.repoUrl ??= `https://github.com/${m[1]}/${m[2]}`;
    } else if (ED_HOST.test(u.hostname)) facts.edUrl ??= href;
  }

  const github = config?.github;
  const ghName = typeof github === 'string' ? github : typeof github === 'object' && github ? (github as { repoURL?: string }).repoURL : undefined;
  if (ghName && !facts.repoUrl) {
    const nwo = ghName.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
    facts.repoUrl = `https://github.com/${nwo}`;
    facts.issuesUrl ??= `${facts.repoUrl}/issues/`;
  }

  const groupUrls = new Set<string>();
  for (const a of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href^="https://www.w3.org/groups/"]'))) {
    const id = parseGroupUrl(a.href);
    if (id) groupUrls.add(`https://www.w3.org/groups/${id}/`);
  }
  if (groupUrls.size) facts.groupUrls = [...groupUrls];

  facts.date = isoDate(doc);
  facts.revision = doc.querySelector('meta[name="revision"]')?.getAttribute('content') ?? undefined;
  facts.outdatedBanner = doc.body?.classList.contains('outdated-spec') ?? false;
  return facts;
}
