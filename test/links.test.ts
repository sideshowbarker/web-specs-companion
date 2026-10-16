// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { clearProblems, collectOutboundLinks, markProblems, revealLink } from '../src/content/links.ts';

beforeEach(() => {
  document.body.innerHTML = `
    <div class="head"><dl><dd><a href="https://www.w3.org/TR/x/#a">header link</a></dd></dl></div>
    <p><a href="https://fetch.spec.whatwg.org/#concept-fetch">fetch</a>
       <a href="#local">local</a>
       <a href="https://fetch.spec.whatwg.org/">no fragment</a>
       <a href="https://dom.spec.whatwg.org/#concept-tree">tree</a></p>
    <section id="references"><a href="https://dom.spec.whatwg.org/#ref">ref</a></section>`;
});

describe('collectOutboundLinks', () => {
  it('collects fragment links to other documents, outside the header and references', () => {
    const { links } = collectOutboundLinks(document, 'https://w3c.github.io/spec/');
    expect(links).toEqual([
      { i: 0, href: 'https://fetch.spec.whatwg.org/#concept-fetch', text: 'fetch' },
      { i: 1, href: 'https://dom.spec.whatwg.org/#concept-tree', text: 'tree' },
    ]);
  });
});

describe('markProblems / clearProblems / revealLink', () => {
  it('outlines the broken links once, and clears them', () => {
    const { elements } = collectOutboundLinks(document, 'https://w3c.github.io/spec/');
    const problem = { i: 1, href: elements[1].href, text: 'tree', target: { shortname: 'dom', title: 'DOM', url: 'https://dom.spec.whatwg.org/' } };
    markProblems(document, elements, [problem]);
    markProblems(document, elements, [problem]);
    expect(document.querySelectorAll('[data-w3cc-problem]')).toHaveLength(1);
    expect(document.querySelectorAll('#w3cc-linkcheck-style')).toHaveLength(1);
    expect(revealLink(elements, 1)).toBe(true);
    expect(revealLink(elements, 9)).toBe(false);
    clearProblems(document);
    expect(document.querySelectorAll('[data-w3cc-problem]')).toHaveLength(0);
    expect(document.getElementById('w3cc-linkcheck-style')).toBeNull();
  });
});
