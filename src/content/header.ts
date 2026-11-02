// Locate the title block without separating its version or publication date from the title.
function titleBlock(doc: Document): Element | null {
  const head = doc.querySelector('.head');
  let title = head?.querySelector(':scope > hgroup, :scope > h1');
  if (title) {
    while (title.nextElementSibling?.matches('#w3c-state, #subtitle, #profile-and-date')) title = title.nextElementSibling;
    return title;
  }
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

// The background's catalog or group lookup establishes that this document is a spec before this runs.
export function enhanceHeader(doc: Document, groupNames: string[]): void {
  let after = titleBlock(doc);
  if (!after) return;
  const head = after.parentElement!;
  const state = head.querySelector<HTMLElement>(':scope > #w3c-state');

  if (groupNames.length) {
    let subtitle = head.querySelector<HTMLElement>(':scope > [data-wsc-group]');
    if (!subtitle) {
      subtitle = doc.createElement('p');
      subtitle.setAttribute('data-wsc-group', '');
      subtitle.style.cssText = `
        display: table;
        box-sizing: border-box;
        max-width: 100%;
        font-size: .9em;
        font-weight: 600;
        line-height: 1.4;
        color: var(--heading-text, currentColor);
        padding: .3em .65em;
        border: 1px solid color-mix(in srgb, var(--heading-text, currentColor) 30%, transparent);
        background: color-mix(in srgb, var(--heading-text, currentColor) 6%, transparent);
        border-radius: .35em;
        margin: .6em 0 1em;
      `;
      after.after(subtitle);
    }
    const names = groupNames.join(' and ');
    if (subtitle.textContent !== names) subtitle.textContent = names;
    if (state) state.style.marginBottom = '0.35em';
    after = subtitle;
  }

  const block = abstractBlock(doc);
  if (!block) return;
  const { abstract, heading } = block;

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
  abstract.style.padding = '0.25em 1em';
  abstract.style.borderInlineStart = '3px solid color-mix(in srgb, var(--heading-text, currentColor) 55%, transparent)';
  abstract.style.backgroundColor = 'color-mix(in srgb, var(--heading-text, currentColor) 7%, transparent)';
  abstract.style.borderRadius = '0 0.25em 0.25em 0';
  if (after.nextElementSibling !== abstract) after.after(abstract);
}
