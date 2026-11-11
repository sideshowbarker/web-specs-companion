// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { collapseStatus, revealInDetails } from '../src/content/status.ts';

const respec = `<section id="abstract"><h2>Abstract</h2><p>An API.</p></section>
<section id="sotd" class="introductory"><div class="header-wrapper"><h2 id="x-status">Status of This Document</h2>
<a class="self-link" href="#sotd"></a></div><p id="first"><em>This section describes the status.</em></p>
<p>Published by a <a id="wg" href="https://www.w3.org/groups/wg/vc/">group</a>.</p></section>
<nav id="toc"><h2>Table of Contents</h2></nav>`;

const bikeshed = `<div data-fill-with="abstract"><p>CSS is a language.</p></div>
<h2 class="heading no-num no-ref no-toc settled" id="sotd"><span class="content">Status of this document</span></h2>
<div data-fill-with="status"><p>This section describes the status.</p></div>
<div data-fill-with="at-risk"></div>
<nav data-fill-with="table-of-contents" id="toc"><h2 id="contents">Table of Contents</h2></nav>`;

const head = `<div class="head"><h1>Title</h1>
<details open><summary>More details about this document</summary><dl><dt>Editors:</dt><dd>Editor</dd></dl></details>
<p class="copyright">Copyright</p><hr></div>`;

beforeEach(() => {
  history.replaceState(null, '', '/');
  document.body.innerHTML = '';
});

describe('collapseStatus', () => {
  it('collapses a ReSpec status section inside the section, with its heading as the summary', () => {
    document.body.innerHTML = respec;
    collapseStatus(document);
    const section = document.getElementById('sotd')!;
    const details = section.firstElementChild as HTMLDetailsElement;
    expect(details.tagName).toBe('DETAILS');
    expect(details.open).toBe(false);
    expect(section.children).toHaveLength(1);
    const summary = details.firstElementChild!;
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.firstElementChild).toBe(document.querySelector('.header-wrapper'));
    expect(summary.textContent?.trim()).toBe('Status of this document');
    expect(details.querySelector('#first')!.closest('details')).toBe(details);
    expect(document.getElementById('toc')!.parentElement).toBe(document.body);
  });

  it('collapses a Bikeshed status heading and the blocks after it, up to the table of contents', () => {
    document.body.innerHTML = bikeshed;
    collapseStatus(document);
    const details = document.querySelector<HTMLDetailsElement>('details[data-wsc-status]')!;
    expect(details.open).toBe(false);
    expect(details.parentElement).toBe(document.body);
    expect(details.querySelector('summary > h2#sotd')).not.toBeNull();
    expect(Array.from(details.children[1].children, (el) => el.getAttribute('data-fill-with')))
      .toEqual(['status', 'at-risk']);
    expect(details.nextElementSibling?.id).toBe('toc');
    expect(document.querySelector('[data-fill-with="abstract"]')!.nextElementSibling).toBe(details);
  });

  it('collapses a status heading whose section number and anchor wrap its text', () => {
    document.body.innerHTML = '<h2><a name="status" id="status">Status of this Document</a></h2><p>Text.</p><hr><h2>Contents</h2>';
    collapseStatus(document);
    const details = document.querySelector('details[data-wsc-status]')!;
    expect(Array.from(details.children[1].children, (el) => el.tagName)).toEqual(['P']);
    expect(details.nextElementSibling?.tagName).toBe('HR');
  });

  it('drops the heading margins, so the collapsed section takes a single line of space', () => {
    document.body.innerHTML = respec;
    collapseStatus(document);
    const details = document.querySelector<HTMLDetailsElement>('details[data-wsc-status]')!;
    expect(document.querySelector<HTMLElement>('.header-wrapper')!.style.margin).toBe('0px');
    expect(document.querySelector<HTMLElement>('#x-status')!.style.margin).toBe('0px');
    expect(details.style.marginTop).toBe('1em');
    document.body.innerHTML = bikeshed;
    collapseStatus(document);
    expect(document.querySelector<HTMLElement>('#sotd')!.style.margin).toBe('0px');
  });

  it('pulls the next heading up to 1em below the collapsed section, past a table of contents out of the flow', () => {
    document.body.innerHTML = respec.replace('<nav id="toc">', '<nav id="toc" style="position: fixed">')
      + '<section id="intro"><div class="header-wrapper" style="display: flex"><h2 id="intro-h">1. Introduction</h2></div></section>';
    const section = document.getElementById('sotd')!;
    section.getBoundingClientRect = () => ({ bottom: 100 }) as DOMRect;
    document.getElementById('toc')!.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    document.getElementById('intro')!.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    document.getElementById('intro-h')!.getBoundingClientRect = () => ({ top: section.style.marginBottom === '0px' ? 148 : 999 }) as DOMRect;
    collapseStatus(document);
    expect(section.style.marginBottom).toBe('-32px');
    expect(document.querySelector<HTMLElement>('details[data-wsc-status]')!.style.margin).toBe('1em 0px 0px');
  });

  it('tops the space below up to 1em when the next block is closer than that', () => {
    document.body.innerHTML = bikeshed;
    document.getElementById('contents')!.getBoundingClientRect = () => ({ top: 110 }) as DOMRect;
    HTMLDetailsElement.prototype.getBoundingClientRect = () => ({ bottom: 100 }) as DOMRect;
    try {
      collapseStatus(document);
    } finally {
      delete (HTMLDetailsElement.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
    }
    expect(document.querySelector<HTMLElement>('details[data-wsc-status]')!.style.marginBottom).toBe('6px');
  });

  it('styles the heading like any other summary, rather than as a section heading', () => {
    for (const html of [respec, bikeshed]) {
      document.body.innerHTML = html;
      collapseStatus(document);
      const heading = document.querySelector<HTMLElement>('summary h2')!;
      expect(heading.style.font).toBe('inherit');
      expect(heading.style.color).toBe('inherit');
      expect(heading.style.letterSpacing).toBe('inherit');
      expect(heading.style.textTransform).toBe('inherit');
    }
  });

  it('moves a ReSpec status section into the header, after its More details and above the copyright', () => {
    document.body.innerHTML = head + respec;
    collapseStatus(document);
    const section = document.getElementById('sotd')!;
    expect(section.parentElement).toBe(document.querySelector('.head'));
    expect(section.previousElementSibling?.querySelector('summary')?.textContent).toBe('More details about this document');
    expect(section.nextElementSibling?.className).toBe('copyright');
    expect(section.querySelector<HTMLElement>('details[data-wsc-status]')!.style.margin).toBe('0px');
    expect(section.style.marginBottom).toBe('');
  });

  it('moves a Bikeshed status section above the copyright of a header without More details', () => {
    document.body.innerHTML = head.replace(/<details open>.*<\/details>/s, '<dl><dt>Editors:</dt><dd>Editor</dd></dl>') + bikeshed;
    collapseStatus(document);
    const details = document.querySelector<HTMLElement>('details[data-wsc-status]')!;
    expect(details.parentElement).toBe(document.querySelector('.head'));
    expect(details.previousElementSibling?.tagName).toBe('DL');
    expect(details.nextElementSibling?.className).toBe('copyright');
    expect(details.querySelector('[data-fill-with="status"]')).not.toBeNull();
    expect(document.querySelector('[data-fill-with="abstract"]')!.nextElementSibling?.id).toBe('toc');
  });

  it('starts the opened section 1em below its summary, whatever the margin of its first block', () => {
    for (const [html, first] of [[respec, '#first'], [bikeshed, '[data-fill-with="status"]']]) {
      document.body.innerHTML = head + html;
      collapseStatus(document);
      const body = document.querySelector<HTMLElement>('details[data-wsc-status] > summary + div')!;
      expect(body.style.marginTop).toBe('1em');
      expect(document.querySelector<HTMLElement>(first)!.parentElement).toBe(body);
      expect(document.querySelector<HTMLElement>(first)!.style.marginTop).toBe('0px');
    }
  });

  it('puts the heading in sentence case, keeping the elements around its text', () => {
    document.body.innerHTML = respec;
    collapseStatus(document);
    expect(document.querySelector('summary')!.textContent?.trim()).toBe('Status of this document');
    document.body.innerHTML = '<h2><a name="status" id="status">Status of This Document</a></h2><p>Text.</p>';
    collapseStatus(document);
    expect(document.querySelector('summary h2 > a#status')!.textContent).toBe('Status of this document');
  });

  it('collapses only once when called again', () => {
    document.body.innerHTML = respec;
    collapseStatus(document);
    collapseStatus(document);
    expect(document.querySelectorAll('details')).toHaveLength(1);
    expect(document.querySelectorAll('summary')).toHaveLength(1);
  });

  it('leaves the section open when the address points into it', () => {
    history.replaceState(null, '', '#wg');
    document.body.innerHTML = respec;
    collapseStatus(document);
    expect(document.querySelector<HTMLDetailsElement>('details[data-wsc-status]')!.open).toBe(true);
  });

  it('keeps the section closed when the address points at its heading', () => {
    history.replaceState(null, '', '#sotd');
    document.body.innerHTML = respec;
    collapseStatus(document);
    expect(document.querySelector<HTMLDetailsElement>('details[data-wsc-status]')!.open).toBe(false);
  });

  it('leaves a page without a status section unchanged', () => {
    document.body.innerHTML = '<section id="sotd"><h2>Status</h2><p>Other.</p></section><h2>Status codes</h2><p>200</p>';
    const html = document.body.innerHTML;
    collapseStatus(document);
    expect(document.body.innerHTML).toBe(html);
  });
});

describe('revealInDetails', () => {
  it('opens each closed disclosure around an element, but not one whose summary holds it', () => {
    document.body.innerHTML = '<details id="outer"><summary>Outer</summary><details id="inner"><summary id="s">Inner</summary><a id="a" href="#">link</a></details></details>';
    revealInDetails(document.getElementById('s')!);
    expect((document.getElementById('inner') as HTMLDetailsElement).open).toBe(false);
    expect((document.getElementById('outer') as HTMLDetailsElement).open).toBe(true);
    revealInDetails(document.getElementById('a')!);
    expect((document.getElementById('inner') as HTMLDetailsElement).open).toBe(true);
  });
});
