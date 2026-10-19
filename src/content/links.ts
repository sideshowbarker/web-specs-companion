import type { LinkProblem } from '../logic/linkcheck.ts';

export interface OutLink {
  i: number;
  href: string;
  text: string;
}

const SKIP = '#references, #normative, #informative, .head, header, nav#toc, #toc, .dfn-panel, dfn-panel, [data-wsc-usedby]';
const STYLE_ID = 'wsc-linkcheck-style';

export function collectOutboundLinks(doc: Document, pageUrl: string) {
  const here = pageUrl.split('#')[0];
  const links: OutLink[] = [];
  const elements: HTMLAnchorElement[] = [];
  for (const a of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="#"]'))) {
    if (a.closest(SKIP)) continue;
    let href: string;
    try {
      href = new URL(a.getAttribute('href')!, pageUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:/.test(href) || href.split('#')[0] === here) continue;
    links.push({ i: elements.length, href, text: (a.textContent ?? '').trim().slice(0, 120) });
    elements.push(a);
  }
  return { links, elements };
}

export function markProblems(doc: Document, elements: HTMLAnchorElement[], problems: LinkProblem[]) {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '[data-wsc-problem] { outline: 2px solid #c00 !important; outline-offset: 2px; }';
    doc.head.append(style);
  }
  for (const p of problems) {
    const el = elements[p.i];
    if (!el) continue;
    el.setAttribute('data-wsc-problem', '');
    el.title = p.suggestion ? `Broken link: no such anchor in ${p.target.title}. Maybe ${p.suggestion}` : `Broken link: no such anchor in ${p.target.title}`;
  }
}

export function clearProblems(doc: Document) {
  doc.getElementById(STYLE_ID)?.remove();
  for (const el of Array.from(doc.querySelectorAll('[data-wsc-problem]'))) {
    el.removeAttribute('data-wsc-problem');
    el.removeAttribute('title');
  }
}

export function revealLink(elements: HTMLAnchorElement[], i: number): boolean {
  const el = elements[i];
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  el.focus();
  return true;
}
