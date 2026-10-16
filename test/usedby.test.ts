// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { UsedByLayer } from '../src/content/usedby.ts';
import type { UsedByEntry } from '../src/logic/footprint.ts';

const entry = (count: number, access = 'public'): UsedByEntry => ({
  count, access, term: 'fetch', type: 'dfn', href: 'https://fetch.spec.whatwg.org/#a',
  specs: Array.from({ length: count }, (_, i) => ({ shortname: `s${i}`, title: `Spec ${i}`, url: `https://example.org/s${i}/` })),
  webdex: access === 'public' ? 'https://dontcallmedom.github.io/webdex/f.html#x' : undefined,
});

const map = { a: entry(3), b: entry(1, 'private') };
const links = { specdex: 'https://dontcallmedom.github.io/specdex/fetch.html' };
const now = (cb: () => void) => cb();

beforeEach(() => {
  document.body.innerHTML = '<p><dfn id="a">fetch</dfn> and <dfn id="b">thing</dfn> and <dfn id="c">other</dfn></p>';
});

const hosts = () => document.querySelectorAll('[data-w3cc-usedby]');
const button = (id: string) => document.querySelector(`[data-w3cc-usedby="${id}"]`)!.shadowRoot!.querySelector('button')!;

describe('UsedByLayer', () => {
  it('adds one count after each definition that other specs use', async () => {
    expect(await new UsedByLayer(document, map, links).render({ schedule: now })).toBe(2);
    expect(hosts()).toHaveLength(2);
    expect(button('a').getAttribute('aria-label')).toBe('Used by 3 other specs');
    expect(button('b').getAttribute('aria-label')).toBe('Not exported, but 1 other spec links to it');
    expect(document.getElementById('a')!.nextElementSibling?.getAttribute('data-w3cc-usedby')).toBe('a');
  });

  it('renders each count once, however often it runs', async () => {
    const layer = new UsedByLayer(document, map, links);
    await layer.render({ schedule: now });
    await layer.render({ schedule: now });
    await new UsedByLayer(document, map, links).render({ schedule: now });
    expect(hosts()).toHaveLength(2);
  });

  it('inserts in batches, and stops when cleared midway', async () => {
    const queue: (() => void)[] = [];
    const layer = new UsedByLayer(document, map, links);
    const done = layer.render({ batchSize: 1, schedule: (cb) => queue.push(cb) });
    queue.shift()!();
    await new Promise((r) => setTimeout(r, 0));
    expect(hosts()).toHaveLength(1);
    layer.clear();
    queue.shift()?.();
    expect(await done).toBe(1);
    expect(hosts()).toHaveLength(0);
  });

  it('opens a popover listing the specs, and closes it with Escape', async () => {
    const layer = new UsedByLayer(document, map, links);
    await layer.render({ schedule: now });
    button('a').click();
    const pop = document.querySelector('[data-w3cc-popover]')!.shadowRoot!;
    expect(pop.querySelectorAll('li a')).toHaveLength(3);
    expect(pop.querySelector('a[href="https://dontcallmedom.github.io/webdex/f.html#x"]')).not.toBeNull();
    expect(pop.querySelector('a[href="https://dontcallmedom.github.io/specdex/fetch.html"]')).not.toBeNull();
    pop.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(document.querySelector('[data-w3cc-popover]')).toBeNull();
  });

  it('removes everything on clear', async () => {
    const layer = new UsedByLayer(document, map, links);
    await layer.render({ schedule: now });
    button('a').click();
    layer.clear();
    expect(hosts()).toHaveLength(0);
    expect(document.querySelector('[data-w3cc-popover]')).toBeNull();
  });
});
