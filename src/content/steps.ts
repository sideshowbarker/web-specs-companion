// Copies a spec's algorithm steps with their numbers. A spec numbers its steps with list markers, which the browser
// draws but leaves out of a copy, so a copy that reaches past a few words of one step gets its plain text from here:
// Each step on a line of its own, behind the number the spec shows for it, with nested steps indented.

const INDENT = '    ';

interface Line {
  depth: number;
  marker: string;
  // The list item whose line this is, when the marker is a step's number, rather than a bullet.
  step?: Element;
  text: string;
}

// The item's computed list-style-type, or the UA style sheet's default for its list when the computed style has none.
function listStyleType(item: Element): string {
  const type = getComputedStyle(item).listStyleType;
  if (type) return type;
  return item.parentElement?.tagName === 'OL' ? 'decimal' : 'disc';
}

const BULLETS = new Set(['disc', 'circle', 'square', 'disclosure-open', 'disclosure-closed']);

function alphabetic(letters: string) {
  return (n: number) => {
    if (n < 1) return String(n);
    let s = '';
    for (; n > 0; n = Math.floor((n - 1) / letters.length)) s = letters[(n - 1) % letters.length] + s;
    return s;
  };
}

function roman(n: number): string {
  if (n < 1 || n > 3999) return String(n);
  const digits: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let s = '';
  for (const [value, numeral] of digits) {
    for (; n >= value; n -= value) s += numeral;
  }
  return s;
}

const lowerAlpha = alphabetic('abcdefghijklmnopqrstuvwxyz');

// Any other counter style an ordered list names is written in decimal.
const COUNTERS: Record<string, (n: number) => string> = {
  decimal: String,
  'decimal-leading-zero': (n) => (n >= 0 && n < 10 ? `0${n}` : String(n)),
  'lower-alpha': lowerAlpha,
  'lower-latin': lowerAlpha,
  'upper-alpha': (n) => lowerAlpha(n).toUpperCase(),
  'upper-latin': (n) => lowerAlpha(n).toUpperCase(),
  'lower-roman': roman,
  'upper-roman': (n) => roman(n).toUpperCase(),
};

function integer(value: string | null): number | undefined {
  const match = value === null ? null : /^\s*([-+]?\d+)/.exec(value);
  return match ? Number(match[1]) : undefined;
}

// The item's ordinal value, from its list's start and reversed attributes and any value attribute along the way:
// https://html.spec.whatwg.org/multipage/grouping-content.html#ordinal-value
function ordinal(item: Element): number {
  const list = item.parentElement!;
  const items = Array.from(list.children).filter((child) => child.tagName === 'LI');
  const reversed = list.tagName === 'OL' && list.hasAttribute('reversed');
  let n = (list.tagName === 'OL' ? integer(list.getAttribute('start')) : undefined) ?? (reversed ? items.length : 1);
  for (const each of items) {
    n = integer(each.getAttribute('value')) ?? n;
    if (each === item) break;
    n += reversed ? -1 : 1;
  }
  return n;
}

// A numbered step's own number, as its list shows it, without the period: '3', 'c', or 'iv'.
export function stepNumber(item: Element): string | undefined {
  const type = listStyleType(item);
  if (type === 'none' || BULLETS.has(type) || item.parentElement?.tagName !== 'OL') return undefined;
  return (COUNTERS[type] ?? String)(ordinal(item));
}

function markerOf(item: Element): Pick<Line, 'marker' | 'step'> {
  if (listStyleType(item) === 'none') return { marker: '' };
  const number = stepNumber(item);
  return number === undefined ? { marker: '-' } : { marker: `${number}.`, step: item };
}

// The selection's text as lines, like the browser's own plain text for it but with each list item's marker. An item
// gets its marker when the selection starts inside it or before it, so a step that only contains the selection's
// start in one of its substeps gets none.
function linesOf(range: Range): Line[] {
  const lines: Line[] = [];
  // Whether the next text starts a line of its own.
  let closed = true;
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? (range.startContainer as Element)
    : range.startContainer.parentElement;
  const startItem = startElement?.closest('li');

  const breakLine = () => {
    if (lines.at(-1)?.text) closed = true;
  };
  const append = (text: string, depth: number, pre: boolean) => {
    if (closed) {
      if (!pre && !text.trim()) return;
      lines.push({ depth, marker: '', text: '' });
      closed = false;
    }
    const line = lines.at(-1)!;
    if (pre) line.text += text;
    else line.text += line.text && !line.text.endsWith(' ') ? text : text.trimStart();
  };
  const visit = (node: Node, depth: number, pre: boolean) => {
    if (!range.intersectsNode(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      let data = (node as Text).data;
      if (node === range.endContainer) data = data.slice(0, range.endOffset);
      if (node === range.startContainer) data = data.slice(range.startOffset);
      if (!pre) append(data.replace(/[ \t\n\r\f]+/g, ' '), depth, false);
      else {
        data.split('\n').forEach((part, i) => {
          if (i > 0) closed = true;
          append(part, depth, true);
        });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const style = getComputedStyle(element);
    if (style.display === 'none') return;
    if (element.tagName === 'BR') {
      closed = true;
      return;
    }
    const preformatted = pre || /^(pre|break-spaces)/.test(style.whiteSpace);
    if (element.tagName === 'LI') {
      const shown = element === startItem || range.comparePoint(element, 0) === 0;
      lines.push({ depth, ...(shown ? markerOf(element) : { marker: '' }), text: '' });
      closed = false;
      for (const child of Array.from(element.childNodes)) visit(child, depth + 1, preformatted);
      closed = true;
      return;
    }
    const block = style.display !== '' && !/^(inline|contents)/.test(style.display);
    // A definition is indented under its term, like each case of a switch under the case's label.
    const childDepth = element.tagName === 'DD' ? depth + 1 : depth;
    if (block) breakLine();
    for (const child of Array.from(element.childNodes)) visit(child, childDepth, preformatted);
    if (block) breakLine();
  };

  const common = range.commonAncestorContainer;
  const element = common.nodeType === Node.ELEMENT_NODE ? (common as Element) : common.parentElement;
  if (!element) return [];
  // The walk starts at the step that holds the selection, so a selection inside one step still gets that step's line.
  visit(element.closest('li') ?? element, 0, false);
  return lines.map((line) => ({ ...line, text: line.text.trimEnd() })).filter((line) => line.text);
}

// A selection inside one step is that whole step when it holds all of the step's own line.
function wholeStep(line: Line): boolean {
  const all = document.createRange();
  all.selectNodeContents(line.step!);
  return linesOf(all).find((each) => each.step === line.step)?.text === line.text;
}

// The selection's plain text with the steps numbered, or undefined when the selection touches no step, or covers
// only part of one step's line.
export function stepsText(range: Range): string | undefined {
  const lines = linesOf(range);
  const steps = lines.filter((line) => line.step);
  if (steps.length === 0) return undefined;
  if (lines.length === 1 && !wholeStep(steps[0])) return undefined;
  const top = Math.min(...lines.map((line) => line.depth));
  return lines
    .map((line) => INDENT.repeat(line.depth - top) + (line.marker ? `${line.marker} ` : '') + line.text)
    .join('\n');
}

// The selection's markup, inside its list, with each link absolute.
function selectionHtml(range: Range): string {
  const fragment = range.cloneContents();
  for (const element of Array.from(fragment.querySelectorAll('[href], [src]'))) {
    for (const name of ['href', 'src']) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      try {
        element.setAttribute(name, new URL(value, document.baseURI).href);
      } catch {
        // A URL that doesn't parse stays as the page has it.
      }
    }
  }
  const container = document.createElement('div');
  const common = range.commonAncestorContainer;
  if (common.nodeType === Node.ELEMENT_NODE && ['OL', 'UL'].includes((common as Element).tagName)) {
    const list = common.cloneNode(false) as Element;
    list.append(fragment);
    container.append(list);
  } else {
    container.append(fragment);
  }
  return container.innerHTML;
}

// A copy-event listener. Once a selection gets numbers, the copy can't keep the browser's own data for it, so the
// listener writes the HTML as well as the plain text. It leaves a copy that the page itself handled alone.
export function copySteps(event: ClipboardEvent) {
  const selection = document.getSelection();
  if (event.defaultPrevented || !event.clipboardData || !selection || selection.rangeCount !== 1) return;
  const range = selection.getRangeAt(0);
  const text = stepsText(range);
  if (text === undefined) return;
  event.clipboardData.setData('text/plain', text);
  event.clipboardData.setData('text/html', selectionHtml(range));
  event.preventDefault();
}
