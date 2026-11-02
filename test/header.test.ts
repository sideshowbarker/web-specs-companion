// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { enhanceHeader } from '../src/content/header.ts';
import { whereOf } from '../src/content/where.ts';

const header = `<div class="head"><p class="logo">W3C</p><h1 id="title">Element Timing API</h1>
<p id="w3c-state">Editor's Draft, 3 September 2026</p>
<details open><summary>More details about this document</summary><dl><dt>Editors:</dt><dd>Editor</dd></dl></details>
<p class="copyright">Copyright</p><hr></div>`;
const content = '<p id="summary-text">An API for <a href="#images">images</a>.</p><p>Also text.</p>';
const group = ['Web Performance Working Group'];

function docFrom(abstract: string, head = header): Document {
  return new DOMParser().parseFromString(`${head}${abstract}<section id="sotd"><h2>Status</h2></section>`, 'text/html');
}

describe('enhanceHeader', () => {
  it.each([
    `<div class="p-summary" data-fill-with="abstract"><h2 id="abstract">Abstract</h2>${content}</div>`,
    `<section id="abstract" class="introductory"><h2>Abstract</h2>${content}</section>`,
  ])('places the group and abstract before the metadata, preserving the content nodes', (markup) => {
    const doc = docFrom(markup);
    const paragraph = doc.querySelector('#summary-text')!;
    const link = paragraph.querySelector('a');
    const details = doc.querySelector('details')!;
    const originalDetails = details.outerHTML;
    enhanceHeader(doc, group);
    const subtitle = doc.querySelector('[data-wsc-group]')!;
    const abstract = doc.querySelector('[data-wsc-abstract]')!;
    expect(doc.querySelector('#w3c-state')!.nextElementSibling).toBe(subtitle);
    expect(subtitle.textContent).toBe(group[0]);
    expect(subtitle.nextElementSibling).toBe(abstract);
    expect(abstract.nextElementSibling).toBe(details);
    expect(abstract.querySelector('#summary-text')).toBe(paragraph);
    expect(paragraph.querySelector('a')).toBe(link);
    expect(abstract.querySelectorAll('p')).toHaveLength(2);
    expect(abstract.querySelector('h2')!.hidden).toBe(true);
    expect(doc.querySelector('#abstract')).toBe(abstract);
    expect(details.outerHTML).toBe(originalDetails);
    expect(doc.querySelector('#sotd')!.parentElement).toBe(doc.body);
    const range = doc.createRange();
    range.selectNodeContents(paragraph);
    expect(whereOf(range).section).toMatchObject({ title: 'Abstract', id: 'abstract' });
  });

  it('does not duplicate the subtitle or abstract when called again', () => {
    const doc = docFrom(`<section id="abstract"><h2>Abstract</h2>${content}</section>`);
    enhanceHeader(doc, group);
    const html = doc.body.innerHTML;
    enhanceHeader(doc, group);
    expect(doc.body.innerHTML).toBe(html);
  });

  it('shows multiple responsible groups as text', () => {
    const doc = docFrom('');
    enhanceHeader(doc, ['Devices and Sensors Working Group', 'Web Applications Working Group']);
    expect(doc.querySelector('[data-wsc-group]')!.textContent).toBe(
      'Devices and Sensors Working Group and Web Applications Working Group',
    );
    enhanceHeader(doc, ['<img src=x onerror=alert(1)>']);
    expect(doc.querySelector('[data-wsc-group]')!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(doc.querySelector('[data-wsc-group] img')).toBeNull();
  });

  it('preserves an abstract section and its separately anchored heading', () => {
    const doc = docFrom(`<section id="abstract"><div class="header-wrapper"><h2 id="abstract-heading">Abstract</h2></div>${content}</section>`);
    enhanceHeader(doc, group);
    expect(doc.querySelector('.head #abstract')).not.toBeNull();
    expect(doc.querySelector('#abstract-heading')).not.toBeNull();
    expect(doc.querySelector<HTMLHeadingElement>('#abstract h2')!.hidden).toBe(true);
  });

  it('moves the abstract even when no group name is available', () => {
    const doc = docFrom(`<section id="abstract"><h2>Abstract</h2>${content}</section>`);
    enhanceHeader(doc, []);
    expect(doc.querySelector('[data-wsc-group]')).toBeNull();
    expect(doc.querySelector('#w3c-state')!.nextElementSibling).toBe(doc.querySelector('#abstract'));
  });

  it('keeps a subtitle when there is no abstract and handles headers without a date', () => {
    const doc = docFrom('', '<div class="head"><h1>Title</h1><dl><dt>Editors</dt></dl></div>');
    enhanceHeader(doc, group);
    expect(doc.querySelector('h1')!.nextElementSibling?.textContent).toBe(group[0]);
  });

  it('does not change pages without a recognizable spec header', () => {
    const doc = docFrom(`<section id="abstract"><h2>Abstract</h2>${content}</section>`, '<h1>Ordinary page</h1>');
    const html = doc.body.innerHTML;
    enhanceHeader(doc, group);
    expect(doc.body.innerHTML).toBe(html);
  });

  it('does not move an arbitrary section with an abstract id', () => {
    const doc = docFrom('<section id="abstract"><h2>Abstract operations</h2><p>Other content.</p></section>');
    enhanceHeader(doc, group);
    expect(doc.querySelector('#abstract')!.parentElement).toBe(doc.body);
  });
});
