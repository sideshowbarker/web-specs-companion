// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { whereOf } from '../src/content/where.ts';
import { range } from './fixtures/ranges.ts';

const BIKESHED = `<h3 class="heading settled" data-level="4.2" id="main-fetch"><span class="secno">4.2. </span><span class="content">Main fetch</span><a class="self-link" href="#main-fetch"></a></h3>
<div class="algorithm" data-algorithm="main fetch">
<p>To <dfn id="concept-main-fetch">main fetch</dfn>, run these steps:</p>
<ol><li><p>Let request be x.</p></li><li><p>If y:</p><ol><li><p>Return z.</p></li></ol></li></ol></div>`;

const RESPEC = `<section id="processing-model"><div class="header-wrapper"><h3 id="x-processing-model"><bdi class="secno">5.1 </bdi>Processing model</h3><a class="self-link" href="#processing-model"></a></div>
<p id="idle-start">The <a>idle period</a> starts.</p><p>It ends.</p></section>`;

const WATTSI = `<h4 id="the-a-element"><span class="secno">4.5.1</span> The <dfn id="dom-a">a</dfn> element</h4>
<p>The <code>a</code> element represents a hyperlink.</p>`;

function page(html: string) {
  document.body.innerHTML = html;
}

describe('whereOf', () => {
  it("names a Bikeshed section, the step, the algorithm, and the algorithm's anchor", () => {
    page(BIKESHED);
    expect(whereOf(range('Return', 'z.'))).toEqual({
      section: { id: 'main-fetch', number: '4.2', title: 'Main fetch' },
      step: '2.1',
      algorithm: 'main fetch',
      anchor: 'concept-main-fetch',
    });
  });

  it('numbers lettered substeps as the page shows them', () => {
    page(`<style>ol ol { list-style-type: lower-alpha; }</style>${BIKESHED}`);
    expect(whereOf(range('Return', 'z.')).step).toBe('2.a');
  });

  it("names a ReSpec section by its section's id, and anchors to the nearest element with an id", () => {
    page(RESPEC);
    const section = { id: 'processing-model', number: '5.1', title: 'Processing model' };
    expect(whereOf(range('starts', 'starts.'))).toEqual({ section, anchor: 'idle-start' });
    expect(whereOf(range('It', 'ends.'))).toEqual({ section, anchor: 'processing-model' });
  });

  it('names a Wattsi section, with markup in its heading', () => {
    page(WATTSI);
    expect(whereOf(range('represents', 'hyperlink.'))).toEqual({
      section: { id: 'the-a-element', number: '4.5.1', title: 'The a element' },
      anchor: 'the-a-element',
    });
  });

  it('counts the steps inside a switch', () => {
    page('<h2 id="s">Switch</h2><ol><li><p>Switch on x:</p><dl class="switch"><dt>"a"</dt><dd><ol><li>Return 1.</li></ol></dd></dl></li></ol>');
    expect(whereOf(range('Return', '1.'))).toEqual({ section: { id: 's', title: 'Switch' }, step: '1.1', anchor: 's' });
  });

  it('names nothing before the first heading', () => {
    page('<p>Intro.</p><h2 id="a">A</h2>');
    expect(whereOf(range('Intro', 'Intro.'))).toEqual({});
  });
});
