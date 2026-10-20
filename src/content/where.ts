// Where a quote is, as a reader of the spec would look for it: the section, from the nearest heading before it, in the
// shapes Bikeshed, ReSpec, and Wattsi write; the step, numbered as the page shows it; the algorithm, where Bikeshed
// names one; and the nearest anchor to link to.
import type { Where } from '../logic/review.ts';
import { stepNumber } from './steps.ts';

const HEADINGS = 'h2, h3, h4, h5, h6';

function headingFor(start: Element): Element | undefined {
  const headings = start.ownerDocument.querySelectorAll(HEADINGS);
  for (let i = headings.length - 1; i >= 0; i--) {
    const heading = headings[i];
    const before = heading.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (before || heading.contains(start)) return heading;
  }
  return undefined;
}

// A heading's number and title, and the id to link to it by: ReSpec's anchor is on the section the heading opens.
function sectionOf(heading: Element): NonNullable<Where['section']> {
  const number = heading.querySelector('.secno')?.textContent?.trim().replace(/\.$/, '');
  const copy = heading.cloneNode(true) as Element;
  for (const el of Array.from(copy.querySelectorAll('.secno, .self-link, [data-wsc-usedby]'))) el.remove();
  const title = (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  const section = heading.closest('section');
  const id = (section?.id && section.querySelector(HEADINGS) === heading ? section.id : '') || heading.id;
  return { ...(id ? { id } : {}), ...(number ? { number } : {}), title };
}

export function whereOf(range: Range): Where {
  const container = range.startContainer;
  const start = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
  if (!start) return {};
  const heading = headingFor(start);
  const section = heading ? sectionOf(heading) : undefined;
  const numbers: string[] = [];
  for (let li = start.closest('li'); li; li = li.parentElement?.closest('li') ?? null) {
    const number = stepNumber(li);
    if (number !== undefined) numbers.unshift(number);
  }
  const algorithmEl = start.closest('.algorithm[data-algorithm]');
  const algorithm = algorithmEl?.getAttribute('data-algorithm') || undefined;
  let anchor: string | undefined;
  for (let el: Element | null = start; el && !(heading && el.contains(heading)); el = el.parentElement) {
    if (el.id) {
      anchor = el.id;
      break;
    }
  }
  anchor ??= algorithmEl?.querySelector('dfn[id]')?.id || section?.id;
  return {
    ...(section ? { section } : {}),
    ...(numbers.length ? { step: numbers.join('.') } : {}),
    ...(algorithm ? { algorithm } : {}),
    ...(anchor ? { anchor } : {}),
  };
}
