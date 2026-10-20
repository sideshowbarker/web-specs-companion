// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { copySteps, stepNumber, stepsText } from '../src/content/steps.ts';

const ALGORITHM = `<ol>
  <li><p>Let <var>x</var> be
    the result of parsing.</p></li>
  <li><p>If <var>x</var> is failure, then:</p>
    <ol>
      <li><p>Report an error.</p></li>
      <li><p>Return failure.</p></li>
    </ol>
  </li>
  <li><p>Return the parsed value.</p></li>
</ol>`;

function page(html: string) {
  document.body.innerHTML = html;
}

function textNodes(): Text[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

// A range from the start of the first text node holding from, to the end of the first text after that holding to.
function range(from: string, to: string): Range {
  const nodes = textNodes();
  const start = nodes.findIndex((n) => n.data.includes(from));
  const r = document.createRange();
  r.setStart(nodes[start], nodes[start].data.indexOf(from));
  for (const node of nodes.slice(start)) {
    const offset = node === nodes[start] ? node.data.indexOf(to, r.startOffset) : node.data.indexOf(to);
    if (offset < 0) continue;
    r.setEnd(node, offset + to.length);
    return r;
  }
  throw new Error(`No ${to} after ${from}`);
}

describe('stepsText', () => {
  it('numbers each step the selection touches as the spec does, with nested steps indented', () => {
    page(ALGORITHM);
    expect(stepsText(range('Let', 'parsed value.'))).toBe(
      [
        '1. Let x be the result of parsing.',
        '2. If x is failure, then:',
        '    1. Report an error.',
        '    2. Return failure.',
        '3. Return the parsed value.',
      ].join('\n'),
    );
  });

  it('numbers a nested list in the style the spec gives it', () => {
    page(`<style>ol ol { list-style-type: lower-alpha; }</style>${ALGORITHM}`);
    expect(stepsText(range('If', 'Return failure.'))).toBe(
      ['2. If x is failure, then:', '    a. Report an error.', '    b. Return failure.'].join('\n'),
    );
  });

  it("honors a list's start and reversed attributes, and a step's value attribute", () => {
    page('<ol start="4"><li>Four.</li><li value="10">Ten.</li><li>Eleven.</li></ol>');
    expect(stepsText(range('Four.', 'Eleven.'))).toBe('4. Four.\n10. Ten.\n11. Eleven.');
    page('<ol reversed><li>Three.</li><li>Two.</li><li>One.</li></ol>');
    expect(stepsText(range('Three.', 'One.'))).toBe('3. Three.\n2. Two.\n1. One.');
  });

  it('writes roman and alphabetic numbers', () => {
    page('<ol style="list-style-type: lower-roman" start="3"><li>Three.</li><li>Four.</li></ol>');
    expect(stepsText(range('Three.', 'Four.'))).toBe('iii. Three.\niv. Four.');
    page('<ol style="list-style-type: upper-alpha" start="26"><li>Last.</li><li>Next.</li></ol>');
    expect(stepsText(range('Last.', 'Next.'))).toBe('Z. Last.\nAA. Next.');
  });

  it('numbers the first step even when the selection starts partway through it', () => {
    page(ALGORITHM);
    expect(stepsText(range('the result', 'Report an error.'))).toBe(
      ['1. the result of parsing.', '2. If x is failure, then:', '    1. Report an error.'].join('\n'),
    );
  });

  it('indents from the shallowest step the selection touches, and leaves out the step they belong to', () => {
    page(ALGORITHM);
    expect(stepsText(range('Report', 'Return failure.'))).toBe('1. Report an error.\n2. Return failure.');
  });

  it('leaves a selection of a few words inside one step alone', () => {
    page(ALGORITHM);
    expect(stepsText(range('result', 'parsing'))).toBeUndefined();
  });

  it("numbers one step whose own line is wholly selected, even if the selection ends at the next step", () => {
    page(ALGORITHM);
    expect(stepsText(range('Return the', 'parsed value.'))).toBe('3. Return the parsed value.');
    expect(stepsText(range('If', 'then:'))).toBe('2. If x is failure, then:');
    const r = range('Let', 'parsing.');
    r.setEnd(range('If', 'If').startContainer, 0);
    expect(stepsText(r)).toBe('1. Let x be the result of parsing.');
  });

  it("puts a step's other paragraphs on lines of their own, a level in", () => {
    page('<ol><li><p>Let x be 1.</p><p class="note">Note: x is never 0.</p></li><li><p>Return x.</p></li></ol>');
    expect(stepsText(range('Let', 'Return x.'))).toBe('1. Let x be 1.\n    Note: x is never 0.\n2. Return x.');
  });

  it("indents each case of a switch under the case's label", () => {
    page(`<ol><li><p>Switch on the result:</p><dl class="switch"><dt>"a"</dt>
      <dd><ol><li>Return 1.</li><li>Return 2.</li></ol></dd><dt>Otherwise</dt><dd>Return 3.</dd></dl></li>
      <li>Return 4.</li></ol>`);
    expect(stepsText(range('Switch', 'Return 4.'))).toBe(
      [
        '1. Switch on the result:',
        '    "a"',
        '        1. Return 1.',
        '        2. Return 2.',
        '    Otherwise',
        '        Return 3.',
        '2. Return 4.',
      ].join('\n'),
    );
  });

  it('marks bulleted items inside a step with a hyphen', () => {
    page(`<ol><li><p>If any of these are true:</p><ul><li>x is 1.</li><li>y is 2.</li></ul>
      <p>then return.</p></li><li>Return x.</li></ol>`);
    expect(stepsText(range('If any', 'Return x.'))).toBe(
      ['1. If any of these are true:', '    - x is 1.', '    - y is 2.', '    then return.', '2. Return x.'].join('\n'),
    );
  });

  it('collapses the spaces at the edges of adjacent text into one', () => {
    page('<ol><li>If the <code>timeout</code> <span> property</span> is set:</li><li>Wait.</li></ol>');
    expect(stepsText(range('If', 'Wait.'))).toBe('1. If the timeout property is set:\n2. Wait.');
  });

  it('leaves out what the page hides', () => {
    page('<ol><li>Let x be 1.<span style="display: none">Hidden.</span></li><li>Return x.</li></ol>');
    expect(stepsText(range('Let', 'Return x.'))).toBe('1. Let x be 1.\n2. Return x.');
  });

  it('keeps the line breaks and spaces of preformatted text', () => {
    page('<ol><li>Run this:<pre style="white-space: pre">a  =  1\nb = 2</pre></li><li>Return a.</li></ol>');
    expect(stepsText(range('Run', 'Return a.'))).toBe('1. Run this:\n    a  =  1\n    b = 2\n2. Return a.');
  });

  it('leaves lists without numbers alone', () => {
    page('<ol style="list-style-type: none"><li>1 Introduction</li><li>2 Model</li></ol>');
    expect(stepsText(range('Introduction', 'Model'))).toBeUndefined();
    page('<ul><li>One.</li><li>Two.</li></ul>');
    expect(stepsText(range('One.', 'Two.'))).toBeUndefined();
    page('<p>Some prose.</p><p>More prose.</p>');
    expect(stepsText(range('Some', 'More prose.'))).toBeUndefined();
  });
});

describe('stepNumber', () => {
  it("gives a step's own number as its list shows it, and nothing for an item without one", () => {
    page(`<style>ol ol { list-style-type: lower-alpha; }</style>${ALGORITHM}<ul><li>Bullet.</li></ul>`
      + '<ol style="list-style-type: none"><li>Plain.</li></ol>');
    expect(Array.from(document.querySelectorAll('li')).map((li) => stepNumber(li))).toEqual(['1', '2', 'a', 'b', '3', undefined, undefined]);
  });
});

describe('copySteps', () => {
  function copy(r: Range) {
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(r);
    const event = new ClipboardEvent('copy', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event;
  }

  it("puts the numbered steps on the clipboard as plain text, and the selection's markup as HTML", () => {
    document.addEventListener('copy', copySteps);
    page('<ol><li>Let <a href="#concept-x">x</a> be 1.</li><li>Return x.</li></ol>');
    const event = copy(range('Let', 'Return x.'));
    document.removeEventListener('copy', copySteps);
    expect(event.defaultPrevented).toBe(true);
    expect(event.clipboardData!.getData('text/plain')).toBe('1. Let x be 1.\n2. Return x.');
    const href = new URL('#concept-x', document.baseURI).href;
    expect(event.clipboardData!.getData('text/html')).toBe(
      `<ol><li>Let <a href="${href}">x</a> be 1.</li><li>Return x.</li></ol>`,
    );
  });

  it('leaves the browser to copy a selection that gets no numbers', () => {
    document.addEventListener('copy', copySteps);
    page(ALGORITHM);
    const event = copy(range('result', 'parsing'));
    document.removeEventListener('copy', copySteps);
    expect(event.defaultPrevented).toBe(false);
    expect(event.clipboardData!.getData('text/plain')).toBe('');
  });

  it('leaves a copy that the page itself handled alone', () => {
    const pages = (event: ClipboardEvent) => {
      event.clipboardData!.setData('text/plain', 'The page.');
      event.preventDefault();
    };
    document.addEventListener('copy', pages);
    document.addEventListener('copy', copySteps);
    page(ALGORITHM);
    const event = copy(range('Let', 'parsed value.'));
    document.removeEventListener('copy', pages);
    document.removeEventListener('copy', copySteps);
    expect(event.clipboardData!.getData('text/plain')).toBe('The page.');
  });
});
