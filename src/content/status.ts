import { edgeBlocks } from './header.ts';

const collapse = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

// The "Status of This Document" heading, as ReSpec, Bikeshed, and hand-written W3C documents mark it up.
function statusHeading(doc: Document): HTMLElement | undefined {
  return Array.from(doc.querySelectorAll<HTMLElement>('h2'))
    .find((h2) => /^(?:[\d.]+\s+)?Status of this document$/i.test(collapse(h2.textContent)));
}

// Collapses the status section into a closed disclosure widget, with the section's own heading as its summary. A
// section element keeps its id and its place, and gets the widget inside it. Otherwise, the widget takes the
// heading's place, and the blocks after the heading, up to the next heading, section, or table of contents.
export function collapseStatus(doc: Document): void {
  if (doc.querySelector('[data-wsc-status]')) return;
  const heading = statusHeading(doc);
  if (!heading) return;
  const block = heading.parentElement?.classList.contains('header-wrapper') ? heading.parentElement : heading;
  const section = block.parentElement?.tagName === 'SECTION' && block.parentElement.firstElementChild === block
    ? block.parentElement
    : undefined;

  const details = doc.createElement('details');
  details.setAttribute('data-wsc-status', '');
  const summary = doc.createElement('summary');
  summary.style.cursor = 'pointer';
  details.append(summary);
  const contents: Node[] = [];
  if (section) {
    contents.push(...Array.from(section.childNodes).filter((node) => node !== block));
    section.prepend(details);
  } else {
    for (let node = block.nextSibling; node; node = node.nextSibling) {
      if (node.nodeType === Node.ELEMENT_NODE
        && ((node as Element).matches('h1, h2, section, nav, hr') || (node as Element).querySelector('h1, h2'))) break;
      contents.push(node);
    }
    block.before(details);
  }
  // Inline, the heading sits on the same line as the disclosure triangle. And without its margins, which set it apart
  // from the section's text, the closed section takes no more space than a line of the header.
  details.style.margin = '1em 0 0';
  block.style.display = block === heading ? 'inline-block' : 'inline-flex';
  block.style.margin = '0';
  heading.style.margin = '0';
  // In sentence case, like "More details about this document".
  const walker = doc.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    text.textContent = text.textContent!.replace(/\bStatus of this document\b/i, 'Status of this document');
  }
  // And it takes the summary's own font and color, like the header's "More details about this document" summary.
  for (const property of ['font', 'color', 'letter-spacing', 'text-transform']) heading.style.setProperty(property, 'inherit');
  summary.append(block);
  const body = doc.createElement('div');
  body.append(...contents);
  details.append(body);
  const container = section ?? details;
  if (moveIntoHeader(doc, container)) {
    // In the header, the copyright paragraph's own margin sets the space below.
    details.style.margin = '0';
  } else {
    closeGapBelow(container);
  }
  // Opened, the section starts 1em below its summary, as the header's "More details about this document" does. Only
  // once it's in the document does its content have the computed display that tells blocks apart.
  body.style.marginTop = '1em';
  for (const el of edgeBlocks(body, 'first')) el.style.marginTop = '0';

  const target = fragmentTarget(doc);
  if (target && details.contains(target) && !summary.contains(target)) details.open = true;
}

// Puts the status section in the header: Right after its "More details about this document" widget, or else right
// above its copyright paragraph. Returns false for a header with neither.
function moveIntoHeader(doc: Document, container: Element): boolean {
  const head = doc.querySelector('.head');
  const more = Array.from(head?.querySelectorAll('details:not([data-wsc-status])') ?? [])
    .find((el) => /^More details\b/i.test(collapse(el.querySelector(':scope > summary')?.textContent)));
  if (more) {
    more.after(container);
    return true;
  }
  const copyright = head?.querySelector('.copyright');
  copyright?.before(container);
  return !!copyright;
}

// The next block's top margin (a section heading's, usually) would leave a gap below the closed section several lines
// tall. So a negative bottom margin cancels all but 1em of it. With the section's own bottom margin at 0, the gap is
// just what the next block brings, whether or not its margin collapses with the section's.
function closeGapBelow(container: HTMLElement): void {
  const view = container.ownerDocument.defaultView;
  if (!view) return;
  container.style.marginBottom = '0';
  let next = container.nextElementSibling;
  while (next) {
    const style = view.getComputedStyle(next);
    if (style.display !== 'none' && style.position !== 'fixed' && style.position !== 'absolute'
      && !next.matches('script, style, template')) break;
    next = next.nextElementSibling;
  }
  if (!next) return;
  // Measured to the block's first content, since a heading's margin inside a flex wrapper doesn't collapse through it.
  let first = next;
  while (first.firstElementChild && !view.getComputedStyle(first).display.startsWith('inline')) first = first.firstElementChild;
  const em = parseFloat(view.getComputedStyle(container).fontSize) || 16;
  const gap = first.getBoundingClientRect().top - container.getBoundingClientRect().bottom;
  if (gap > em) container.style.marginBottom = `${-Math.round(gap - em)}px`;
}

function fragmentTarget(doc: Document): Element | null {
  const fragment = doc.defaultView?.location.hash.slice(1);
  if (!fragment) return null;
  try {
    return doc.getElementById(decodeURIComponent(fragment));
  } catch {
    return doc.getElementById(fragment);
  }
}

// Opens each closed disclosure widget that hides an element, so that it can be scrolled to.
export function revealInDetails(el: Element): void {
  for (let details = el.parentElement?.closest('details'); details; details = details.parentElement?.closest('details')) {
    const summary = details.querySelector(':scope > summary');
    if (!details.open && !summary?.contains(el)) details.open = true;
  }
}
