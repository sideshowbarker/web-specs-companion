import { describe, it, expect, vi } from 'vitest';
import { omniboxTarget, suggestionFor, SITE_SEARCH } from '../src/background/omnibox.ts';
import type { SearchItem } from '../src/logic/search.ts';

const spec: SearchItem = { kind: 'spec', label: 'Fetch & <Friends>', detail: 'fetch · LS', url: 'https://fetch.spec.whatwg.org/', keys: [], boost: 0 };
const idl: SearchItem = { kind: 'idl', label: 'Request', detail: 'interface (Web IDL)', url: 'https://dontcallmedom.github.io/webidlpedia/names/Request.html', keys: [], boost: 0, idlName: 'Request' };

describe('suggestionFor', () => {
  it('escapes and marks up for engines that take markup', () => {
    expect(suggestionFor(spec, true)).toEqual({
      content: 'https://fetch.spec.whatwg.org/',
      description: '<match>Fetch &amp; &lt;Friends&gt;</match> <dim>fetch · LS</dim>',
    });
  });
  it('uses plain text otherwise', () => {
    expect(suggestionFor(spec, false).description).toBe('Fetch & <Friends> — fetch · LS');
  });
});

describe('omniboxTarget', () => {
  it('opens a chosen suggestion URL as-is', async () => {
    expect(await omniboxTarget('https://x.test/', vi.fn(), vi.fn())).toBe('https://x.test/');
  });
  it('opens the best match, resolving an IDL name to its definition', async () => {
    expect(await omniboxTarget('fetch', async () => [spec], vi.fn())).toBe('https://fetch.spec.whatwg.org/');
    const resolveIdl = vi.fn(async () => 'https://fetch.spec.whatwg.org/#request');
    expect(await omniboxTarget('Request', async () => [idl], resolveIdl)).toBe('https://fetch.spec.whatwg.org/#request');
    expect(resolveIdl).toHaveBeenCalledWith('Request');
  });
  it('falls back to the W3C site search', async () => {
    expect(await omniboxTarget('no such thing', async () => [], vi.fn())).toBe(`${SITE_SEARCH}no%20such%20thing`);
  });
});
