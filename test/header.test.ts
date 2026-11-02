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
  it('keeps a WHATWG title and date together, above its workstream and abstract', () => {
    const doc = docFrom(`<div data-fill-with="abstract"><h2 id="abstract">Abstract</h2>${content}</div>`,
      `<div class="head"><hgroup><h1>Fetch</h1><p id="subtitle">Living Standard <time>Today</time></p></hgroup>
      <div data-fill-with="spec-metadata"><dl><dt>Participate:</dt><dd>GitHub</dd></dl></div></div>`);
    const titleBlock = doc.querySelector('hgroup')!;
    enhanceHeader(doc, ['Fetch Workstream']);
    const group = doc.querySelector('[data-wsc-group]')!;
    expect(group?.textContent).toBe('Fetch Workstream');
    expect(titleBlock.nextElementSibling).toBe(group);
    expect(doc.querySelector('#subtitle')!.parentElement).toBe(titleBlock);
    expect(group.nextElementSibling).toBe(doc.querySelector('#abstract'));
    expect(doc.querySelector('#abstract')!.nextElementSibling).toBe(doc.querySelector('[data-fill-with="spec-metadata"]'));
  });

  it('adds a workstream to the HTML header without treating another section as its abstract', () => {
    const doc = docFrom('<h3 id="abstract">Where does this specification fit?</h3><p>Introduction.</p>',
      '<header class="head"><hgroup><h1>HTML</h1><p id="living-standard">Living Standard</p></hgroup><nav>Versions</nav></header>');
    enhanceHeader(doc, ['HTML Workstream']);
    expect(doc.querySelector('hgroup')!.nextElementSibling?.textContent).toBe('HTML Workstream');
    expect(doc.querySelector('#abstract')!.parentElement).toBe(doc.body);
  });

  it.each([
    ['TC39', '<div id="spec-container"><h1 class="version">Draft ECMA-262 / Today</h1><h1 class="title">Language Specification</h1><div id="metadata-block">About</div></div>', '#spec-container > h1.title'],
    ['3D Formats Working Group', '<div id="header"><h1>glTF Specification</h1><div class="details">Authors</div></div>', '#header > h1'],
    ['WebGL Working Group', '<h1>ANGLE_instanced_arrays</h1><h2>Name</h2><p>ANGLE_instanced_arrays</p><h2>Overview</h2><p>Overview text.</p>', 'body > h1'],
    ['WebAssembly Working Group', '<div role="main"><section><h1>WebAssembly Core Specification</h1><p>Contents</p></section></div>', '[role="main"] h1'],
  ])('adds the group to a %s document without inventing an abstract', (name, markup, selector) => {
    const doc = docFrom('', markup);
    enhanceHeader(doc, [name]);
    expect(doc.querySelector(selector)!.nextElementSibling?.textContent).toBe(name);
    expect(doc.querySelector('[data-wsc-abstract]')).toBeNull();
    const html = doc.body.innerHTML;
    enhanceHeader(doc, [name]);
    expect(doc.body.innerHTML).toBe(html);
  });

  it('keeps an AOM version and publication date with its title', () => {
    const doc = docFrom(`<div data-fill-with="abstract"><h2>Abstract</h2>${content}</div>`,
      '<div class="head"><h1>AVIF</h1><h2 id="subtitle">v1.2</h2><h3 id="profile-and-date">Final Deliverable, Today</h3><dl><dt>Editors</dt></dl></div>');
    enhanceHeader(doc, ['AOM']);
    expect(doc.querySelector('#profile-and-date')!.nextElementSibling?.textContent).toBe('AOM');
    expect(doc.querySelector('[data-wsc-abstract]')!.nextElementSibling?.tagName).toBe('DL');
  });

  it.each([
    ['<div id="identifiers"><dl><dt>Authors</dt></dl></div><h1 id="rfcnum">RFC 9110</h1><h1 id="title">HTTP Semantics</h1>', '<section id="section-abstract"><h2 id="abstract">Abstract</h2>', '</section>'],
    ['<header><table><tr><td>Authors</td></tr></table><div id="rfc.title"><h1>HTTP Semantics</h1></div></header>', '<h2 id="rfc.abstract">Abstract</h2><div class="lead">', '</div>'],
  ])('puts an RFC title, group, and abstract before its author metadata', (head, open, close) => {
    const doc = docFrom(`${open}${content}${close}`, head);
    const paragraph = doc.querySelector('#summary-text');
    const metadata = doc.querySelector('#identifiers, table')!;
    enhanceHeader(doc, ['HTTP Working Group']);
    const abstract = doc.querySelector('[data-wsc-abstract]')!;
    expect(abstract).not.toBeNull();
    expect(abstract.querySelector('#summary-text')).toBe(paragraph);
    expect(abstract.previousElementSibling?.textContent).toBe('HTTP Working Group');
    expect(abstract.compareDocumentPosition(metadata) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(doc.querySelector('#abstract, #rfc\\.abstract')).not.toBeNull();
    const html = doc.body.innerHTML;
    enhanceHeader(doc, ['HTTP Working Group']);
    expect(doc.body.innerHTML).toBe(html);
  });

  it('moves a legacy HTML RFC abstract without flattening its links or preformatted body', () => {
    const doc = docFrom('', `<pre>Authors and date
      <span class="h1">Data URLs</span>
      Status of this Memo
      <span class="h2"><a id="section-1">1</a>. Abstract</span>
      A <a href="#section-2">summary</a>.
      <span class="h2"><a id="section-2">2</a>. Description</span>
      Other text.</pre>`);
    const link = doc.querySelector('a[href]');
    enhanceHeader(doc, ['IETF']);
    const abstract = doc.querySelector<HTMLElement>('[data-wsc-abstract]')!;
    expect(abstract).not.toBeNull();
    expect(abstract.querySelector('a[href]')).toBe(link);
    expect(abstract.textContent).not.toContain('Other text');
    expect(abstract.style.whiteSpace).toBe('pre-wrap');
    expect(doc.querySelector('#section-1')).not.toBeNull();
    expect(doc.querySelector('#section-2')!.closest('pre')).not.toBeNull();
    expect(doc.querySelector('[data-wsc-group]')!.previousElementSibling?.textContent).toBe('Data URLs');
    const html = doc.body.innerHTML;
    enhanceHeader(doc, ['IETF']);
    expect(doc.body.innerHTML).toBe(html);
  });

  it.each(['<h2>Abstract</h2>', '<div class="header-wrapper"><h2>Abstract</h2></div>'])('preserves an abstract section whose anchor uses a generator-specific name', (heading) => {
    const doc = docFrom(`<section id="summary">${heading}${content}</section>`);
    enhanceHeader(doc, group);
    expect(doc.querySelector('[data-wsc-abstract]')?.id).toBe('summary');
    expect(doc.querySelector('#summary #summary-text')).not.toBeNull();
  });

  it('stops a standalone abstract before a sibling containing another heading', () => {
    const doc = docFrom(`<h2 id="abstract">Abstract</h2>${content}<div id="status"><h2>Status</h2><p>Details.</p></div>`);
    enhanceHeader(doc, group);
    expect(doc.querySelector('[data-wsc-abstract] #status')).toBeNull();
    expect(doc.querySelector('#status')!.parentElement).toBe(doc.body);
  });

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
    const doc = docFrom(`<section id="abstract"><h2>Abstract</h2>${content}</section>`, '<p>Page without a title</p>');
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

it('keeps the title and later sections in place when the abstract shares their section', () => {
  const doc = new DOMParser().parseFromString('<section id="whole"><h1>Title</h1><h2 id="abstract">Abstract</h2><p>Summary.</p><h2 id="scope">Scope</h2><p>Scope text.</p></section>', 'text/html');
  enhanceHeader(doc, ['Group']);
  expect(doc.querySelector('[data-wsc-abstract]')?.textContent).toBe('AbstractSummary.');
  expect(doc.querySelector('#scope')!.parentElement?.id).toBe('whole');
  expect(doc.querySelector('h1')!.nextElementSibling?.textContent).toBe('Group');
});
