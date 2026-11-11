function isW3cLogo(img: HTMLImageElement): boolean {
  if (/^W3C(?:\s+logo)?$/i.test(img.alt.trim())) return true;
  try {
    const src = new URL(img.getAttribute('src') ?? '', img.ownerDocument.baseURI);
    return /^(?:www\.)?w3\.org$/i.test(src.hostname)
      && /^\/(?:Icons\/w3c(?:[_-](?:home|main))?|StyleSheets\/TR\/[^/]+\/logos\/W3C)(?:[.-][^/]*)?$/i.test(src.pathname);
  } catch {
    return false;
  }
}

function removeW3cLogos(doc: Document): void {
  for (const img of doc.querySelectorAll<HTMLImageElement>('.head img, header img, #header img')) {
    if (!isW3cLogo(img)) continue;
    const head = img.closest('.head, header, #header');
    const logo = img.closest('picture') ?? img;
    let wrapper = logo.parentElement;
    logo.remove();
    while (wrapper && wrapper !== head && wrapper.matches('a, p, div, span')
      && !wrapper.children.length && !wrapper.textContent?.trim()) {
      const parent = wrapper.parentElement;
      wrapper.remove();
      wrapper = parent;
    }
  }
}

// Locate the title block ahead of the document metadata.
function titleBlock(doc: Document): Element | null {
  const head = doc.querySelector('.head');
  let title = head?.querySelector(':scope > hgroup, :scope > h1');
  if (title) return title;
  const rfcTitle = doc.getElementById('rfc.title');
  if (rfcTitle?.parentElement?.tagName === 'HEADER') {
    const header = rfcTitle.parentElement;
    if (header.firstElementChild !== rfcTitle) header.prepend(rfcTitle);
    return rfcTitle;
  }
  title = doc.querySelector('#spec-container > h1.title, #header > h1, h1#title, h1.title')
    ?? doc.querySelector('main h1, [role="main"] h1, article h1')
    ?? doc.querySelector('h1');
  if (title) {
    // xml2rfc puts its author metadata before the document title.
    const metadata = doc.querySelector('#external-metadata, #internal-metadata, #identifiers');
    if (metadata && doc.getElementById('section-abstract')) {
      let block = metadata;
      while (block.parentElement && block.parentElement !== title.parentElement) block = block.parentElement;
      if (block.parentElement === title.parentElement && (block.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        const number = doc.getElementById('rfcnum');
        if (number?.parentElement === title.parentElement) block.before(number);
        block.before(title);
      }
    }
    return title;
  }
  const legacyTitle = doc.querySelector('pre .h1');
  if (!legacyTitle) return null;
  const heading = doc.createElement('h1');
  legacyTitle.closest('pre')!.before(heading);
  heading.append(legacyTitle);
  return heading;
}

function abstractBlock(doc: Document): { abstract: HTMLElement; heading: HTMLElement } | undefined {
  const existing = doc.querySelector<HTMLElement>('[data-wsc-abstract]');
  if (existing) return { abstract: existing, heading: existing.querySelector<HTMLElement>('h1, h2, .h2')! };

  const abstract = doc.querySelector<HTMLElement>('section#abstract, div#abstract, div[data-fill-with="abstract"], #section-abstract');
  const heading = abstract?.querySelector<HTMLElement>(':scope > h2, :scope > .header-wrapper > h2');
  if (abstract && heading && (heading.querySelector('.content') ?? heading).textContent?.trim() === 'Abstract') return { abstract, heading };

  // Some generators leave the abstract heading and its paragraphs as siblings, without a section wrapper.
  const standalone = Array.from(doc.querySelectorAll<HTMLElement>('h2, pre .h2')).find((el) =>
    /^(?:\d+\.?\s+)?Abstract$/.test((el.querySelector('.content') ?? el).textContent?.trim() ?? ''));
  if (!standalone) return undefined;
  const section = standalone.closest('section');
  if (section && section.querySelectorAll('h1, h2, h3, h4, h5, h6').length === 1) {
    return { abstract: section, heading: standalone };
  }
  const wrapper = doc.createElement('div');
  const pre = standalone.closest('pre');
  if (pre) wrapper.style.whiteSpace = 'pre-wrap';
  let next = standalone.nextSibling;
  wrapper.append(standalone);
  while (next) {
    if (next.nodeType === Node.ELEMENT_NODE) {
      const el = next as Element;
      if (el.matches('h1, h2, h3, h4, h5, h6, .h2, section, aside, nav, hr') || el.querySelector('h1, h2, h3, h4, h5, h6')) break;
    }
    const node = next;
    next = node.nextSibling;
    wrapper.append(node);
  }
  return { abstract: wrapper, heading: standalone };
}

const collapse = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

// Each current editor in the header's metadata list, with their affiliation when the hCard markup gives one.
function editorNames(doc: Document): string[] {
  const label = Array.from(doc.querySelectorAll('.head dt, header dt, #header dt'))
    .find((dt) => /^Editors?:$/i.test(collapse(dt.textContent)));
  const names: string[] = [];
  for (let dd = label?.nextElementSibling; dd?.tagName === 'DD'; dd = dd.nextElementSibling) {
    const name = collapse(dd.querySelector('.p-name, .fn')?.textContent);
    const org = collapse(dd.querySelector('.p-org, .org')?.textContent);
    const entry = name ? (org ? `${name} (${org})` : name) : collapse(dd.textContent);
    if (entry && !names.includes(entry)) names.push(entry);
  }
  return names;
}

function placeEditors(doc: Document, after: Element): void {
  const names = editorNames(doc);
  let line = doc.querySelector<HTMLElement>('[data-wsc-editors]');
  if (!names.length) {
    line?.remove();
    return;
  }
  const label = names.length > 1 ? 'Editors:' : 'Editor:';
  const list = ` ${names.join(', ')}`;
  if (!line) {
    line = doc.createElement('p');
    line.setAttribute('data-wsc-editors', '');
    line.style.margin = '0 0 1.25em';
  }
  if (line.textContent !== label + list) {
    const strong = doc.createElement('strong');
    strong.textContent = label;
    line.replaceChildren(strong, list);
  }
  if (after.nextElementSibling !== line) after.after(line);
}

// The line in the title block with the document's status and date, which the group's name joins.
function dateLine(title: Element, last: Element): HTMLElement | undefined {
  const chain: Element[] = [];
  for (let el: Element | null = title; el; el = el === last ? null : el.nextElementSibling) {
    chain.push(...(el.tagName === 'HGROUP' ? Array.from(el.children) : [el]));
  }
  return chain.reverse().find((el): el is HTMLElement => el.tagName !== 'H1'
    && (el.matches('#w3c-state, #profile-and-date, #living-standard') || !!el.querySelector('time')));
}

// The background's catalog or group lookup establishes that this document is a spec before this runs.
export function enhanceHeader(doc: Document, groupNames: string[]): void {
  removeW3cLogos(doc);
  const title = titleBlock(doc);
  if (!title) return;
  let after = title;
  while (after.nextElementSibling?.matches('#w3c-state, #subtitle, #profile-and-date')) after = after.nextElementSibling;

  if (groupNames.length) {
    let badge = doc.querySelector<HTMLElement>('[data-wsc-group]');
    if (!badge) {
      badge = doc.createElement('span');
      badge.setAttribute('data-wsc-group', '');
      badge.style.cssText = `
        box-sizing: border-box;
        max-width: 100%;
        font-style: normal;
        font-weight: 600;
        line-height: 1.4;
        color: var(--heading-text, currentColor);
        padding: .3em .65em;
        border: 1px solid color-mix(in srgb, var(--heading-text, currentColor) 30%, transparent);
        background: color-mix(in srgb, var(--heading-text, currentColor) 6%, transparent);
        border-radius: .35em;
      `;
    }
    const names = groupNames.join(' and ');
    if (badge.textContent !== names) badge.textContent = names;
    const line = dateLine(title, after);
    if (line) {
      // Sized from the header's text rather than the date line's, which may be a heading. And raised by half the
      // difference between the two cap heights, so its text is centered on the date's rather than sharing its baseline.
      const view = doc.defaultView;
      const size = .9 * (parseFloat(view?.getComputedStyle(after.parentElement!).fontSize ?? '') || 16);
      const lineSize = parseFloat(view?.getComputedStyle(line).fontSize ?? '') || size;
      badge.style.display = 'inline-block';
      badge.style.fontSize = `${size}px`;
      badge.style.verticalAlign = `calc(0.5cap * ${Math.max(0, lineSize / size - 1).toFixed(3)})`;
      badge.style.margin = '0 0 0 .6em';
      if (line.lastElementChild !== badge) line.append(badge);
    } else {
      badge.style.display = 'table';
      badge.style.verticalAlign = '';
      badge.style.fontSize = '.9em';
      badge.style.margin = '.6em 0 1em';
      if (after.nextElementSibling !== badge) after.after(badge);
      after = badge;
    }
  }

  const block = abstractBlock(doc);
  if (block) after = placeAbstract(after, block);
  placeEditors(doc, after);
}

// The blocks that an element's content starts (or ends) with, outermost first, down to the first one that starts (or
// ends) with text or an inline element rather than another block. Their margins would otherwise add to the padding.
export function edgeBlocks(root: Element, end: 'first' | 'last'): HTMLElement[] {
  const view = root.ownerDocument.defaultView;
  const chain: HTMLElement[] = [];
  for (let parent = root; ;) {
    const nodes = Array.from(parent.childNodes);
    if (end === 'last') nodes.reverse();
    const edge = nodes.find((node) => node.nodeType === Node.TEXT_NODE
      ? !!node.textContent?.trim()
      : node.nodeType === Node.ELEMENT_NODE && view?.getComputedStyle(node as Element).display !== 'none'
        // An empty fragment anchor takes no space.
        && !(!node.hasChildNodes() && (node as Element).matches('a, span')));
    if (edge?.nodeType !== Node.ELEMENT_NODE) return chain;
    const el = edge as HTMLElement;
    if (!/^(?:block|flow-root|flex|grid|list-item|table)$/.test(view?.getComputedStyle(el).display ?? '')) return chain;
    chain.push(el);
    parent = el;
  }
}

function placeAbstract(after: Element, { abstract, heading }: { abstract: HTMLElement; heading: HTMLElement }): Element {
  const doc = after.ownerDocument;

  // Keep the heading for review-location lookup, and put its fragment target on a visible element.
  if (heading.id) {
    if (!abstract.id) abstract.id = heading.id;
    else {
      const anchor = doc.createElement('span');
      anchor.id = heading.id;
      anchor.setAttribute('aria-label', heading.textContent ?? 'Abstract');
      abstract.prepend(anchor);
    }
    heading.removeAttribute('id');
  }
  // Legacy RFC headings put the fragment on a child anchor, which must stay visible after the heading is hidden.
  for (const target of Array.from(heading.querySelectorAll<HTMLElement>('[id]'))) {
    const anchor = doc.createElement('span');
    anchor.id = target.id;
    target.removeAttribute('id');
    abstract.prepend(anchor);
  }
  heading.hidden = true;
  heading.style.setProperty('display', 'none', 'important');
  if (heading.parentElement?.classList.contains('header-wrapper')) heading.parentElement.hidden = true;
  abstract.setAttribute('data-wsc-abstract', '');
  abstract.style.marginBlock = '1.25em';
  // The box's padding alone sets the space inside it, rather than the margins of whatever the abstract starts and ends
  // with. And the line above drops its bottom margin, so the box has the same space above it as below it.
  abstract.style.padding = '0.75em 1em';
  (after as HTMLElement).style.marginBottom = '0';
  abstract.style.borderInlineStart = '3px solid color-mix(in srgb, var(--heading-text, currentColor) 55%, transparent)';
  abstract.style.backgroundColor = 'color-mix(in srgb, var(--heading-text, currentColor) 7%, transparent)';
  abstract.style.borderRadius = '0 0.25em 0.25em 0';
  if (after.nextElementSibling !== abstract) after.after(abstract);
  // Only once it's in the document does the abstract's content have the computed display that tells blocks apart.
  for (const el of edgeBlocks(abstract, 'first')) el.style.marginTop = '0';
  for (const el of edgeBlocks(abstract, 'last')) el.style.marginBottom = '0';
  return abstract;
}
