// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { specs, groups } from './fixtures/catalog.ts';

vi.mock('../src/ui/api.ts', () => ({ send: vi.fn(), sendToTab: vi.fn(), open: vi.fn(), activeTab: vi.fn() }));
vi.mock('../src/shared/settings.ts', () => ({ getSettings: vi.fn(async () => ({ usedBy: true })), setSettings: vi.fn(async () => {}) }));

import { send } from '../src/ui/api.ts';
import { SpecCard } from '../src/ui/components/SpecCard.tsx';
import { GroupBlock } from '../src/ui/components/GroupBlock.tsx';
import { Radar } from '../src/ui/components/Radar.tsx';
import { Tpac } from '../src/ui/components/Tpac.tsx';
import type { TpacView } from '../src/data/tpac.ts';

const sendMock = send as unknown as ReturnType<typeof vi.fn>;

afterEach(cleanup);

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockImplementation(async (type: string) => {
    if (type === 'get-group-details') return { details: { identifier: 'wg/webappsec', name: 'WebAppSec', chairs: ['Daniel Veditz', 'Mike West'], teamContacts: ['Simone Onofri'], endDate: '2026-10-30', homepage: '' } };
    if (type === 'get-radar') return { radar: { label: 'Editor\u2019s Draft', notes: [] } };
    return { footprint: null };
  });
});

describe('SpecCard', () => {
  it('shows the title, maturity, links, and the responsible group', async () => {
    render(<SpecCard ctx={{ kind: 'spec', url: 'https://w3c.github.io/webappsec-fetch-metadata/', pageKind: 'ed', spec: specs[0], groups: [groups[0]] }} tabId={1} slots={{}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Fetch Metadata Request Headers');
    expect(screen.getByText('ED')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Latest TR version' }).getAttribute('href')).toBe('https://www.w3.org/TR/fetch-metadata/');
    await waitFor(() => expect(screen.getByText('Chairs: Daniel Veditz, Mike West')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Editor\u2019s Draft', { selector: '.radar-label' })).toBeTruthy());
  });

  it('omits page tools when no content script reported facts', () => {
    render(<SpecCard ctx={{ kind: 'spec', url: 'x', pageKind: 'ed', spec: specs[0], groups: [] }} tabId={1} slots={{}} />);
    expect(screen.queryByText('On this page')).toBeNull();
  });

  it('puts the browser-support row right after the header', async () => {
    const impl = { engines: ['gecko', 'webkit', 'blink'], basis: 'shared', core: 1, ships: { gecko: 1, webkit: 1, blink: 1 }, lacks: {}, bcd: { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' } };
    sendMock.mockImplementation(async (type: string) => (type === 'get-implementations' ? { impl } : { footprint: null }));
    const { container } = render(<SpecCard ctx={{ kind: 'spec', url: 'x', pageKind: 'ed', spec: specs[0], groups: [] }} tabId={1} slots={{}} />);
    await screen.findByAltText('Firefox: implements it');
    expect(container.querySelector('header')!.nextElementSibling!.className).toBe('impl-row');
  });
});

describe('GroupBlock', () => {
  it('warns about a charter that ends soon and lists TPAC slots', async () => {
    const slots = [{ uid: 'g', title: 'WebAppSec', start: Date.parse('2026-10-26T09:00:00Z'), end: Date.parse('2026-10-26T12:00:00Z'), room: 'Munster Suite', kind: 'group' as const }];
    render(<GroupBlock group={groups[0]} slots={slots} now={Date.parse('2026-10-16T00:00:00Z')} />);
    await waitFor(() => expect(screen.getByText('Charter ends 30 October 2026, in 14 days')).toBeTruthy());
    expect(screen.getByText(/Munster Suite/)).toBeTruthy();
  });
});

describe('Tpac', () => {
  const view = (over: Partial<TpacView>): TpacView => ({ visible: true, now: [], next: [], slots: {}, fetchedAt: 0, origin: 'live', ...over });
  it('counts down before TPAC starts', () => {
    render(<Tpac view={view({ firstStart: Date.parse('2026-10-26T09:00:00Z') })} now={Date.parse('2026-10-21T09:00:00Z')} />);
    expect(screen.getByText(/in 5 days/)).toBeTruthy();
  });
  it('lists sessions during the week, and filters them', async () => {
    const ev = (uid: string, kind: 'group' | 'breakout') => ({ uid, title: uid, start: 0, end: 1, kind });
    render(<Tpac view={view({ firstStart: 0, now: [ev('CSS WG', 'group'), ev('Agents breakout', 'breakout')] })} now={10} />);
    expect(screen.getByText('CSS WG')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Breakouts'));
    await waitFor(() => expect(screen.queryByText('CSS WG')).toBeNull());
    expect(screen.getByText('Agents breakout')).toBeTruthy();
  });
  it('shows nothing outside the TPAC window', () => {
    const { container } = render(<Tpac view={view({ visible: false })} />);
    expect(container.textContent).toBe('');
  });
});

import { Footprint } from '../src/ui/components/Footprint.tsx';

describe('Footprint', () => {
  it('shows the most-used definitions and says where the data comes from', async () => {
    sendMock.mockImplementation(async (type: string) => {
      if (type === 'get-footprint') return { footprint: { referencedBy: [], usesTermsFrom: [], normativeRefs: [], extendsInterfaces: [], crawlDate: '9 October 2026', revision: 'def', specdex: 'https://dontcallmedom.github.io/specdex/fetch.html' } };
      if (type === 'get-used-by') return { map: { a: { count: 3, access: 'public', term: 'fetch', type: 'dfn', specs: [], href: 'https://fetch.spec.whatwg.org/#a' } }, specdex: '' };
      return {};
    });
    render(<Footprint shortname="fetch" pageKind="tr" pageRevision="abc" />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'fetch' }).getAttribute('href')).toBe('https://fetch.spec.whatwg.org/#a'));
    expect(screen.getByText(/comes from the editor/)).toBeTruthy();
    expect(screen.getByText(/different revision/)).toBeTruthy();
  });
});

import { Freshness } from '../src/ui/components/Freshness.tsx';

describe('Freshness', () => {
  it('lists the browser-support, MDN, and Can I Use data', async () => {
    sendMock.mockImplementation(async () => ({ sources: [{ name: 'specs', fetchedAt: 0, origin: 'live' }, { name: 'implementations', fetchedAt: 0, origin: 'live' }, { name: 'mdn', fetchedAt: 0, origin: 'live' }, { name: 'caniuse', fetchedAt: 0, origin: 'live' }] }));
    render(<Freshness now={3 * 3_600_000} />);
    expect(await screen.findByText(/Browser support 3 hours ago/)).toBeTruthy();
    expect(screen.getByText(/MDN articles 3 hours ago/)).toBeTruthy();
    expect(screen.getByText(/Can I Use 3 hours ago/)).toBeTruthy();
  });
});

import { CardRow } from '../src/ui/components/CardRow.tsx';
import type { ImplView } from '../src/logic/implementations.ts';

describe('Implementations', () => {
  const bcd = { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' };
  const view = (over: Partial<ImplView> = {}): ImplView => ({
    engines: ['gecko', 'webkit', 'blink'], basis: 'shared', core: 4, ships: { gecko: 4, webkit: 4, blink: 4 }, lacks: {}, bcd, ...over,
  });
  const answer = (impl: ImplView | null) => sendMock.mockImplementation(async (type: string) => (type === 'get-implementations' ? { impl } : {}));
  const referrerPolicy = view({
    engines: ['webkit', 'blink'],
    core: 21,
    ships: { gecko: 3, webkit: 21, blink: 21 },
    lacks: {
      gecko: {
        features: [
          { key: 'api.HTMLAnchorElement.referrerPolicy.unsafe-url', mdn: 'https://developer.mozilla.org/docs/Web/API/HTMLAnchorElement/referrerPolicy' },
          { key: 'api.HTMLAreaElement.referrerPolicy.unsafe-url' },
        ],
        more: 16,
      },
    },
  });
  const bcdLine = (_: string, el: Element | null) => el?.tagName === 'P' && el.textContent === 'From BCD 8.1.6, 15 October 2026.';

  it('shows all three logos in color, and a green check mark, when all three engines implement the spec', async () => {
    answer(view());
    render(<CardRow shortname="fetch" />);
    const firefox = await screen.findByAltText('Firefox: implements it');
    expect(firefox.getAttribute('title')).toBe('Firefox: ships 4 of the 4 features at least two engines ship');
    expect(firefox.classList.contains('no')).toBe(false);
    expect(screen.getByAltText('Safari: implements it')).toBeTruthy();
    expect(screen.getByAltText('Chrome: implements it')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Implemented in all three engines' }).className).toBe('check all');
    expect(screen.queryByRole('button', { name: 'What\u2019s missing?' })).toBeNull();
  });

  it('grays out the engine that lacks the core, and lists what it lacks on request', async () => {
    answer(referrerPolicy);
    render(<CardRow shortname="referrer-policy" />);
    const firefox = await screen.findByAltText('Firefox: doesn\u2019t implement it');
    expect(firefox.classList.contains('no')).toBe(true);
    expect(firefox.getAttribute('title')).toBe('Firefox: ships 3 of the 21 features at least two engines ship');
    expect(screen.getByRole('img', { name: 'Implemented in two of the three engines' }).className).toBe('check two');
    const why = screen.getByRole('button', { name: 'What\u2019s missing?' });
    expect(why.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('impl-why')!.hidden).toBe(true);
    fireEvent.click(why);
    expect(why.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('impl-why')!.hidden).toBe(false);
    expect(screen.getByText('Firefox ships 3 of the 21 features at least two engines ship. It lacks:')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'api.HTMLAnchorElement.referrerPolicy.unsafe-url' }).getAttribute('href'))
      .toBe('https://developer.mozilla.org/docs/Web/API/HTMLAnchorElement/referrerPolicy');
    expect(screen.queryByRole('link', { name: 'api.HTMLAreaElement.referrerPolicy.unsafe-url' })).toBeNull();
    expect(screen.getByText('api.HTMLAreaElement.referrerPolicy.unsafe-url')).toBeTruthy();
    expect(screen.getByText('and 16 more')).toBeTruthy();
    expect(screen.getByText(bcdLine)).toBeTruthy();
  });

  it('leaves the check-mark slot empty when only one engine implements the spec', async () => {
    const lacking = { features: [{ key: 'api.A' }, { key: 'api.B' }], more: 0 };
    answer(view({ engines: ['blink'], basis: 'any', core: 2, ships: { gecko: 0, webkit: 0, blink: 2 }, lacks: { gecko: lacking, webkit: lacking } }));
    const { container } = render(<CardRow shortname="usb" />);
    expect((await screen.findByAltText('Chrome: implements it')).getAttribute('title')).toBe('Chrome: ships 2 of the 2 features any engine ships');
    const slot = container.querySelector('.check')!;
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(slot.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'What\u2019s missing?' }));
    expect(screen.getByText('Firefox ships 0 of the 2 features any engine ships. It lacks:')).toBeTruthy();
    expect(screen.getByText('Safari ships 0 of the 2 features any engine ships. It lacks:')).toBeTruthy();
  });

  it('grays out all three logos, and lists the features once, when no engine ships any', async () => {
    const lacking = { features: [{ key: 'api.A' }, { key: 'api.B' }, { key: 'api.C' }], more: 0 };
    answer(view({ engines: [], basis: 'none', core: 3, ships: { gecko: 0, webkit: 0, blink: 0 }, lacks: { gecko: lacking, webkit: lacking, blink: lacking } }));
    render(<CardRow shortname="x" />);
    const chrome = await screen.findByAltText('Chrome: doesn\u2019t implement it');
    expect(chrome.getAttribute('title')).toBe('No engine ships any of the 3 features BCD lists for this spec');
    fireEvent.click(screen.getByRole('button', { name: 'What\u2019s missing?' }));
    expect(screen.getByText('No engine ships any of the 3 features BCD lists for this spec:')).toBeTruthy();
    expect(screen.getAllByText('api.A')).toHaveLength(1);
  });

  it('words the counts for a core of one feature', async () => {
    answer(view({ engines: ['webkit', 'blink'], core: 1, ships: { gecko: 0, webkit: 1, blink: 1 }, lacks: { gecko: { features: [{ key: 'api.A' }], more: 0 } } }));
    render(<CardRow shortname="x" />);
    expect((await screen.findByAltText('Firefox: doesn\u2019t implement it')).getAttribute('title'))
      .toBe('Firefox: doesn\u2019t ship the one feature at least two engines ship');
    expect(screen.getByAltText('Safari: implements it').getAttribute('title')).toBe('Safari: ships the one feature at least two engines ship');
  });

  it("says when the data is the series' current level's", async () => {
    answer({ ...referrerPolicy, fromSeries: { shortname: 'css-grid-2', title: 'CSS Grid Layout Module Level 2' } });
    render(<CardRow shortname="css-grid-1" />);
    expect((await screen.findByAltText('Safari: implements it')).getAttribute('title'))
      .toBe('Safari: ships 21 of the 21 features at least two engines ship (from the data for CSS Grid Layout Module Level 2)');
    fireEvent.click(screen.getByRole('button', { name: 'What\u2019s missing?' }));
    expect(screen.getByText('This spec has no data of its own, so this is from the data for CSS Grid Layout Module Level 2.')).toBeTruthy();
  });

  it('shows the sentence without a list for a gray engine the record lists nothing for', async () => {
    answer({ ...referrerPolicy, lacks: {} });
    render(<CardRow shortname="x" />);
    fireEvent.click(await screen.findByRole('button', { name: 'What\u2019s missing?' }));
    expect(screen.getByText('Firefox ships 3 of the 21 features at least two engines ship. It lacks:')).toBeTruthy();
    expect(document.querySelector('#impl-why ul')).toBeNull();
  });

  it('drops the old verdict, and closes "What\u2019s missing?", when the card changes to another spec', async () => {
    let answerSecond: ((v: unknown) => void) | undefined;
    sendMock.mockImplementation(async (type: string, req: { shortname?: string }) => {
      if (type !== 'get-implementations') return { footprint: null };
      if (req.shortname === specs[0].shortname) return { impl: referrerPolicy };
      return new Promise((resolve) => { answerSecond = resolve; });
    });
    const ctx = (i: number) => ({ kind: 'spec' as const, url: 'x', pageKind: 'ed' as const, spec: specs[i], groups: [] });
    const { rerender } = render(<SpecCard ctx={ctx(0)} tabId={1} slots={{}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'What\u2019s missing?' }));
    expect(screen.getByRole('button', { name: 'What\u2019s missing?' }).getAttribute('aria-expanded')).toBe('true');
    rerender(<SpecCard ctx={ctx(1)} tabId={1} slots={{}} />);
    expect(screen.queryByAltText('Safari: implements it')).toBeNull();
    await waitFor(() => expect(answerSecond).toBeDefined());
    answerSecond!({ impl: referrerPolicy });
    await waitFor(() => expect(screen.getByRole('button', { name: 'What\u2019s missing?' }).getAttribute('aria-expanded')).toBe('false'));
  });

  it('shows no row when there is no data', async () => {
    answer(null);
    const { container } = render(<CardRow shortname="x" />);
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('get-implementations', { shortname: 'x' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe('');
  });
});

describe('Radar', () => {
  it('says how far the latest TR is behind the draft, and links to the draft', async () => {
    const notes = [{ kind: 'behind-ed', months: 15, edDate: '2026-02-02', edUrl: 'https://w3c.github.io/battery/' }];
    sendMock.mockImplementation(async (type: string) => (type === 'get-radar' ? { radar: { label: 'Latest TR version', notes } } : { footprint: null }));
    render(<Radar tabId={1} url="https://www.w3.org/TR/battery-status/" />);
    const link = await screen.findByRole('link', { name: 'Editor\u2019s Draft' });
    expect(link.getAttribute('href')).toBe('https://w3c.github.io/battery/');
    expect(screen.getByRole('listitem').textContent).toBe('This TR is 15 months behind the Editor\u2019s Draft (2026-02-02).');
  });
});

import type { MdnItem, MdnView } from '../src/logic/mdn.ts';

describe('MDN button', () => {
  const content = { commit: 'a'.repeat(40), date: '2026-10-18' };
  const link = (title: string, slug: string) => ({ title, url: `https://developer.mozilla.org/docs/${slug}` });
  const item = (title: string, slug: string, children: MdnItem[] = []): MdnItem => ({
    ...link(title, slug),
    children,
    count: children.reduce((n, c) => n + 1 + c.count, 0),
  });
  const request = item('Request', 'Web/API/Request', [item('body property', 'Web/API/Request/body'), item('Request() constructor', 'Web/API/Request/Request')]);
  const fetchView: MdnView = {
    count: 6,
    content,
    overviews: [link('Fetch API', 'Web/API/Fetch_API')],
    sections: [
      { name: 'Interfaces', items: [item('Headers', 'Web/API/Headers'), request] },
      { name: 'CSS properties', items: [item('`grid` CSS property', 'Web/CSS/grid')] },
    ],
  };
  const many = (n: number) => Array.from({ length: n }, (_, i) => item(`Interface ${String(i).padStart(2, '0')}`, `Web/API/I${i}`));
  const answerMdn = (mdn: MdnView | null, impl: unknown = null) =>
    sendMock.mockImplementation(async (type: string) => (type === 'get-mdn' ? { mdn } : type === 'get-implementations' ? { impl } : {}));

  it('shows the button at the right end of the row, even without browser-support data', async () => {
    answerMdn(fetchView);
    render(<CardRow shortname="fetch" />);
    const button = await screen.findByRole('button', { name: '6 MDN articles' });
    expect(button.textContent).toBe('6');
    expect(button.getAttribute('title')).toBe('6 MDN articles');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('mdn-list');
    expect(button.querySelector('svg path')!.getAttribute('fill')).toBe('currentColor');
    expect(button.parentElement!.className).toBe('impl-row');
    expect(document.querySelector('.impl')).toBeNull();
  });

  it("renders the list only once it's first opened: the overview, the sections, and the members", async () => {
    answerMdn(fetchView);
    render(<CardRow shortname="fetch" />);
    const button = await screen.findByRole('button', { name: '6 MDN articles' });
    const panel = document.getElementById('mdn-list')!;
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe('');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(screen.getByText('6 MDN articles', { selector: 'strong' })).toBeTruthy();
    const overview = screen.getByRole('link', { name: 'Fetch API' });
    expect(overview.getAttribute('href')).toBe('https://developer.mozilla.org/docs/Web/API/Fetch_API');
    expect(overview.closest('p')!.textContent).toBe('Overview: Fetch API');
    expect(screen.getByText('Interfaces (2)').closest('details')!.open).toBe(true);
    expect(screen.getByText('grid', { selector: 'code' })).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
    const toggle = screen.getByRole('button', { name: '2 articles under Request' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: 'body property' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)!.hidden).toBe(false);
    expect(screen.getByRole('link', { name: 'body property' })).toBeTruthy();
    const source = screen.getByRole('link', { name: 'MDN' });
    expect(source.getAttribute('href')).toBe('https://github.com/mdn/content');
    expect(source.closest('p')!.textContent).toBe('From MDN, as of 18 October 2026.');
    fireEvent.click(button);
    expect(panel.hidden).toBe(true);
  });

  it("shows one of the row's two panels at a time", async () => {
    const impl = {
      engines: ['webkit', 'blink'], basis: 'shared', core: 2, ships: { gecko: 0, webkit: 2, blink: 2 },
      lacks: { gecko: { features: [{ key: 'api.A' }], more: 0 } }, bcd: { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' },
    };
    answerMdn(fetchView, impl);
    render(<CardRow shortname="fetch" />);
    const missing = await screen.findByRole('button', { name: 'What\u2019s missing?' });
    const mdn = await screen.findByRole('button', { name: '6 MDN articles' });
    fireEvent.click(missing);
    expect(document.getElementById('impl-why')!.hidden).toBe(false);
    fireEvent.click(mdn);
    expect(document.getElementById('impl-why')!.hidden).toBe(true);
    expect(missing.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('mdn-list')!.hidden).toBe(false);
    fireEvent.click(missing);
    expect(document.getElementById('mdn-list')!.hidden).toBe(true);
    expect(document.getElementById('impl-why')!.hidden).toBe(false);
  });

  it('starts the sections collapsed when the spec has more than 12 top-level articles', async () => {
    answerMdn({ ...fetchView, count: 15, overviews: [link('Fetch API', 'Web/API/Fetch_API'), link('Streams API', 'Web/API/Streams_API')], sections: [{ name: 'Interfaces', items: many(13) }] });
    render(<CardRow shortname="fetch" />);
    fireEvent.click(await screen.findByRole('button', { name: '15 MDN articles' }));
    expect(screen.getByText('Interfaces (13)').closest('details')!.open).toBe(false);
    expect(screen.getByRole('link', { name: 'Fetch API' }).closest('p')!.textContent).toBe('Overviews: Fetch API, Streams API');
  });

  it('filters a list of more than 40 articles, and restores the sections when the filter is cleared', async () => {
    answerMdn({ ...fetchView, count: 41, sections: [{ name: 'Interfaces', items: [...many(12), request] }] });
    render(<CardRow shortname="fetch" />);
    fireEvent.click(await screen.findByRole('button', { name: '41 MDN articles' }));
    expect(screen.getByText('Interfaces (13)').closest('details')!.open).toBe(false);
    const filter = screen.getByRole('searchbox', { name: 'Filter articles' });
    expect(filter.getAttribute('placeholder')).toBe('Filter articles');
    fireEvent.input(filter, { target: { value: 'body' } });
    expect(screen.getByText('Interfaces (1)').closest('details')!.open).toBe(true);
    expect(screen.getByRole('link', { name: 'body property' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Interface 00' })).toBeNull();
    const toggle = screen.getByRole('button', { name: '1 article under Request' }) as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.disabled).toBe(true);
    fireEvent.input(filter, { target: { value: 'zzz' } });
    expect(screen.getByText('No articles match.')).toBeTruthy();
    fireEvent.input(filter, { target: { value: '' } });
    expect(screen.getByText('Interfaces (13)').closest('details')!.open).toBe(false);
    expect(screen.queryByText('No articles match.')).toBeNull();
  });

  it("says when the list is the series' current level's, and counts one article as one", async () => {
    answerMdn({
      count: 1,
      content,
      overviews: [link('CSS display', 'Web/CSS/Guides/Display')],
      sections: [],
      fromSeries: { shortname: 'css-display-3', title: 'CSS Display Module Level 3' },
    });
    render(<CardRow shortname="css-display-4" />);
    fireEvent.click(await screen.findByRole('button', { name: '1 MDN article' }));
    expect(screen.getByText('This spec has no MDN articles of its own, so these are the ones for CSS Display Module Level 3.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'CSS display' }).closest('p')!.textContent).toBe('Overview: CSS display');
    expect(document.querySelector('#mdn-list details')).toBeNull();
  });

  it('shows no MDN button when the spec has no MDN articles', async () => {
    const impl = { engines: ['gecko', 'webkit', 'blink'], basis: 'shared', core: 1, ships: { gecko: 1, webkit: 1, blink: 1 }, lacks: {}, bcd: { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' } };
    answerMdn(null, impl);
    render(<CardRow shortname="fetch" />);
    await screen.findByAltText('Firefox: implements it');
    expect(screen.queryByRole('button', { name: /MDN article/ })).toBeNull();
    expect(document.getElementById('mdn-list')).toBeNull();
  });
});
