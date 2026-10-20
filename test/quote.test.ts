// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { findQuote, PageText, quoteOf } from '../src/content/quote.ts';
import { range } from './fixtures/ranges.ts';

function page(html: string): PageText {
  document.body.innerHTML = html;
  return new PageText(document.body);
}

const HTML =
  '<p>Otherwise, if request\u2019s <a href="#t">response tainting</a> is "cors", then set response.</p><p>Next step.</p>';

describe('PageText', () => {
  it('collapses whitespace across text nodes, and puts a space between blocks', () => {
    expect(page('<p>Let  <var>x</var>\n  be 1.</p><p>Return x.</p>').text).toBe('Let x be 1. Return x.');
    expect(page('<ol><li>One</li><li>Two</li></ol>').text).toBe('One Two');
  });

  it("leaves out scripts, styles, templates, and the extension's own elements", () => {
    const html = '<p>A<script>x()</script>B<style>p {}</style>C<template>T</template></p>'
      + '<span data-wsc-review="button">Comment</span><p>D</p>';
    expect(page(html).text).toBe('ABC D');
  });
});

describe('quoteOf', () => {
  it('takes the quote, the text on either side, the words around it in its block, and its offset', () => {
    const q = quoteOf(page(HTML), range('request', 'then'))!;
    expect(q.quote).toEqual({
      exact: 'request\u2019s response tainting is "cors", then',
      prefix: 'Otherwise, if ',
      suffix: ' set response. Next step.',
    });
    expect(q.context).toEqual({ before: 'Otherwise, if', after: 'set response.' });
    expect(q.position).toBe(14);
  });

  it('quotes a selection that starts at an element boundary from its first text', () => {
    const p = page(HTML);
    const r = document.createRange();
    r.setStart(document.querySelector('p')!, 0);
    r.setEnd(document.querySelector('a')!.firstChild!, 8);
    expect(quoteOf(p, r)!.quote.exact).toBe('Otherwise, if request\u2019s response');
  });

  it('gives nothing for a selection of only whitespace', () => {
    expect(quoteOf(page(HTML), range(' ', ' '))).toBeUndefined();
  });
});

describe('findQuote', () => {
  it('finds a quote again in a page that changed around it, and with its whitespace changed', () => {
    const { quote } = quoteOf(page(HTML), range('request', 'then'))!;
    const p = page(`<p>A new first paragraph.</p>${HTML.replace(' is "cors"', '\n   is\n "cors"')}`);
    expect(findQuote(p, quote)!.toString().replace(/\s+/g, ' ')).toBe('request\u2019s response tainting is "cors", then');
  });

  it('tells a recurring quote apart by the text around it', () => {
    const html = '<p>Step one. Return failure. Then a.</p><p>Step two. Return failure. Then b.</p>';
    page(html);
    const node = document.querySelectorAll('p')[1].firstChild as Text;
    const r = document.createRange();
    r.setStart(node, node.data.indexOf('Return'));
    r.setEnd(node, node.data.indexOf('failure.') + 'failure.'.length);
    const { quote } = quoteOf(new PageText(document.body), r)!;
    const found = findQuote(page(`<p>Intro.</p>${html}`), quote)!;
    expect(found.startContainer.parentElement).toBe(document.querySelectorAll('p')[2]);
    expect(found.toString()).toBe('Return failure.');
  });

  it('finds nothing for a quote whose own words changed', () => {
    const { quote } = quoteOf(page(HTML), range('request', 'then'))!;
    expect(findQuote(page(HTML.replace('"cors"', '"no-cors"')), quote)).toBeUndefined();
  });
});
