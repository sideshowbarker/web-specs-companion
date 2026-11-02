export function enhanceHeader(doc: Document, groupNames: string[]): void {
  const head = doc.querySelector('.head');
  const title = head?.querySelector(':scope > h1');
  if (!head || !title) return;
  const state = head.querySelector<HTMLElement>(':scope > #w3c-state');
  let after: Element = state ?? title;

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

  const abstract = doc.querySelector<HTMLElement>('section#abstract, div#abstract, div[data-fill-with="abstract"]');
  const heading = abstract?.querySelector<HTMLElement>(':scope > h2, :scope > .header-wrapper > h2');
  if (!abstract || !heading || (heading.querySelector('.content') ?? heading).textContent?.trim() !== 'Abstract') return;

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
