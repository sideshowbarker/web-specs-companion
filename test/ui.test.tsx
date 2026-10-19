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
  it('lists the browser-support, MDN, Can I Use, and test-results data', async () => {
    sendMock.mockImplementation(async () => ({ sources: [{ name: 'specs', fetchedAt: 0, origin: 'live' }, { name: 'implementations', fetchedAt: 0, origin: 'live' }, { name: 'mdn', fetchedAt: 0, origin: 'live' }, { name: 'caniuse', fetchedAt: 0, origin: 'live' }, { name: 'wpt', fetchedAt: 0, origin: 'live' }] }));
    render(<Freshness now={3 * 3_600_000} />);
    expect(await screen.findByText(/Browser support 3 hours ago/)).toBeTruthy();
    expect(screen.getByText(/MDN articles 3 hours ago/)).toBeTruthy();
    expect(screen.getByText(/Can I Use 3 hours ago/)).toBeTruthy();
    expect(screen.getByText(/Test results 3 hours ago/)).toBeTruthy();
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
    expect(button.parentElement!.className).toBe('refs');
    expect(button.closest('.impl-row')).toBeTruthy();
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

import type { CiuAnswer, CiuEntry, CiuRun, Support } from '../src/logic/caniuse.ts';

describe('Can I Use button', () => {
  const run = (from: string, to: string, support: Support, month?: string, more: Partial<CiuRun> = {}): CiuRun => ({
    from,
    to,
    support,
    ...(month ? { month } : {}),
    ...more,
  });
  const fetchEntry: CiuEntry = {
    id: 'fetch',
    title: 'Fetch',
    usage: 97.27,
    notes: { 1: 'One.', 2: 'Only in `ServiceWorker` scopes. See [bug 1](https://b.test/1).', 3: 'Three.', 4: 'Four.' },
    runs: {
      firefox: [run('2', '33', 'n', '2006-10'), run('34', '38', 'n', '2014-12', { flag: true, notes: [1, 4] }), run('39', '157', 'y', '2015-07', { current: true })],
      safari: [run('3.1', '10', 'n', '2008-03'), run('10.1', '27', 'y', '2017-03', { current: true }), run('27.1', 'TP', 'y', undefined, { beta: true })],
      chrome: [
        run('4', '39', 'n', '2010-01'),
        run('40', '41', 'a', '2015-01', { notes: [2, 3] }),
        run('42', '154', 'y', '2015-04', { current: true }),
        run('155', '157', 'y', undefined, { beta: true }),
      ],
    },
  };
  const simple = (id: string, title: string): CiuEntry => ({
    id,
    title,
    usage: 90,
    notes: {},
    runs: { firefox: [run('3.5', '157', 'y', '2009-06', { current: true })], safari: [run('6', '27', 'y', '2012-07', { current: true })], chrome: [run('13', '154', 'y', '2011-08', { current: true })] },
  });
  const source = { version: '1.0.30001816', updated: '2026-10-13' };
  const answer: CiuAnswer = { features: [simple('cors', 'Cross-Origin Resource Sharing'), fetchEntry], source };
  const mdn = {
    count: 1,
    overviews: [],
    sections: [{ name: 'Interfaces', items: [{ title: 'Request', url: 'https://developer.mozilla.org/docs/Web/API/Request', children: [], count: 0 }] }],
    content: { commit: 'a'.repeat(40), date: '2026-10-18' },
  };
  const answerAll = (caniuse: CiuAnswer | null, more: { mdn?: unknown; impl?: unknown } = {}) =>
    sendMock.mockImplementation(async (type: string) =>
      type === 'get-caniuse' ? { caniuse } : type === 'get-mdn' ? { mdn: more.mdn ?? null } : type === 'get-implementations' ? { impl: more.impl ?? null } : {});

  it('shows the logo and the count after the MDN button, even without browser-support data', async () => {
    answerAll(answer, { mdn });
    render(<CardRow shortname="fetch" />);
    const button = await screen.findByRole('button', { name: '2 Can I Use features' });
    await screen.findByRole('button', { name: '1 MDN article' });
    expect(button.textContent).toBe('2');
    expect(button.getAttribute('title')).toBe('2 Can I Use features');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('caniuse-list');
    const logo = button.querySelector('img')!;
    expect(logo.getAttribute('src')).toBe('icons/caniuse.png');
    expect(logo.getAttribute('alt')).toBe('');
    const refs = button.parentElement!;
    expect(refs.className).toBe('refs');
    expect([...refs.children].map((c) => c.getAttribute('aria-controls'))).toEqual(['mdn-list', 'caniuse-list']);
    expect(document.querySelector('.impl')).toBeNull();
  });

  it("renders the list only once it's first opened, with each feature's chips, timeline, and notes", async () => {
    answerAll(answer);
    render(<CardRow shortname="fetch" />);
    const button = await screen.findByRole('button', { name: '2 Can I Use features' });
    const panel = document.getElementById('caniuse-list')!;
    expect(panel.hidden).toBe(true);
    expect(panel.innerHTML).toBe('');
    fireEvent.click(button);
    expect(panel.hidden).toBe(false);
    expect(screen.getByText('2 Can I Use features', { selector: 'strong' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Fetch' });
    expect(link.getAttribute('href')).toBe('https://caniuse.com/fetch');
    const fetchLine = link.closest('details')!;
    expect(fetchLine.open).toBe(true);
    const summary = fetchLine.querySelector('summary')!;
    expect([...summary.children].map((c) => c.className)).toEqual(['ciu-head']);
    expect(summary.textContent).toBe('Fetch 97.3%39+10.1+42+');
    expect(summary.querySelector('.ciu-usage')!.getAttribute('title')).toBe('Global support across all browsers, per caniuse');
    const bar = screen.getByRole('img', { name: 'Chrome: no in 4\u201339; partial in 40\u201341 (notes 2, 3); yes in 42\u2013154; yes in 155\u2013157 (beta)' });
    expect(bar.querySelectorAll('.ciu-seg')).toHaveLength(4);
    expect(bar.querySelector('.ciu-seg.a')!.getAttribute('title')).toBe('Chrome 40\u201341: partial (notes 2, 3), from Jan 2015');
    expect(bar.querySelector('.ciu-seg')!.getAttribute('style')).toMatch(/--at:.*--w:/);
    expect(screen.getByText('42+ \u00b7 Apr 2015')).toBeTruthy();
    expect(screen.getByText('10.1+ \u00b7 Mar 2017')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
    const notes = screen.getByText('Notes (4)').closest('details')!;
    expect(notes.open).toBe(false);
    expect(notes.querySelector('code')!.textContent).toBe('ServiceWorker');
    expect(screen.getByRole('link', { name: 'bug 1' }).getAttribute('href')).toBe('https://b.test/1');
    const legends = [...panel.querySelectorAll('.ciu-legend')];
    expect(legends).toHaveLength(2);
    expect(legends.every((l) => l.closest('details.ciu-feature'))).toBe(true);
    expect(legends[0].textContent).toBe('YesPartialNoBehind a flagPrefixedBeta');
    const credit = screen.getByRole('link', { name: 'caniuse.com' });
    expect(credit.getAttribute('href')).toBe('https://caniuse.com/');
    expect(credit.closest('p')!.textContent).toBe('From caniuse.com, by Alexis Deveria (CC BY 4.0), data as of 13 October 2026. Desktop Firefox, Safari, and Chrome; mobile and other browsers are on caniuse.com.');
  });

  it('paints each segment above the ones after it, so the minimum width of a short run shows', async () => {
    answerAll(answer);
    render(<CardRow shortname="fetch" />);
    fireEvent.click(await screen.findByRole('button', { name: '2 Can I Use features' }));
    const bar = screen.getByRole('img', { name: 'Chrome: no in 4\u201339; partial in 40\u201341 (notes 2, 3); yes in 42\u2013154; yes in 155\u2013157 (beta)' });
    expect([...bar.querySelectorAll<HTMLElement>('.ciu-seg')].map((s) => s.style.zIndex)).toEqual(['4', '3', '2', '1']);
    expect(bar.querySelector<HTMLElement>('.ciu-today')!.style.zIndex).toBe('5');
  });

  it("opens one of the row's three panels at a time", async () => {
    const impl = {
      engines: ['webkit', 'blink'], basis: 'shared', core: 2, ships: { gecko: 0, webkit: 2, blink: 2 },
      lacks: { gecko: { features: [{ key: 'api.A' }], more: 0 } }, bcd: { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' },
    };
    answerAll(answer, { mdn, impl });
    render(<CardRow shortname="fetch" />);
    const missing = await screen.findByRole('button', { name: 'What\u2019s missing?' });
    const mdnButton = await screen.findByRole('button', { name: '1 MDN article' });
    const ciu = await screen.findByRole('button', { name: '2 Can I Use features' });
    const shown = () => ['impl-why', 'mdn-list', 'caniuse-list'].filter((id) => !document.getElementById(id)!.hidden);
    fireEvent.click(missing);
    expect(shown()).toEqual(['impl-why']);
    fireEvent.click(ciu);
    expect(shown()).toEqual(['caniuse-list']);
    fireEvent.click(mdnButton);
    expect(shown()).toEqual(['mdn-list']);
    fireEvent.click(mdnButton);
    expect(shown()).toEqual([]);
  });

  it("opens a lone feature at once, and says when the features are the series' current level's", async () => {
    answerAll({ features: [fetchEntry], source, fromSeries: { shortname: 'fetch-2', title: 'Fetch Level 2' } });
    render(<CardRow shortname="fetch-1" />);
    fireEvent.click(await screen.findByRole('button', { name: '1 Can I Use feature' }));
    expect(screen.getByRole('link', { name: 'Fetch' }).closest('details')!.open).toBe(true);
    expect(screen.getByText('This spec has no Can I Use features of its own, so these are the ones for Fetch Level 2.')).toBeTruthy();
  });

  it('filters a list of more than 10 features by title', async () => {
    const many = Array.from({ length: 11 }, (_, i) => simple(`f${i}`, `Feature ${String(i).padStart(2, '0')}`));
    answerAll({ features: many, source });
    render(<CardRow shortname="html" />);
    fireEvent.click(await screen.findByRole('button', { name: '11 Can I Use features' }));
    expect(screen.getByRole('link', { name: 'Feature 00' }).closest('details')!.open).toBe(false);
    const filter = screen.getByRole('searchbox', { name: 'Filter features' });
    expect(filter.getAttribute('placeholder')).toBe('Filter features');
    fireEvent.input(filter, { target: { value: '07' } });
    expect(screen.getByRole('link', { name: 'Feature 07' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Feature 08' })).toBeNull();
    fireEvent.input(filter, { target: { value: 'zzz' } });
    expect(screen.getByText('No features match.')).toBeTruthy();
    fireEvent.input(filter, { target: { value: '' } });
    expect(screen.getAllByRole('link', { name: /^Feature / })).toHaveLength(11);
  });

  it('shows no Can I Use button when the spec has no caniuse features', async () => {
    answerAll(null, { mdn });
    render(<CardRow shortname="fetch" />);
    await screen.findByRole('button', { name: '1 MDN article' });
    expect(screen.queryByRole('button', { name: /Can I Use/ })).toBeNull();
    expect(document.getElementById('caniuse-list')).toBeNull();
  });
});

import { allUrl, dirUrl, onlyUrl, type WptAnswer, type WptSpec } from '../src/logic/wpt.ts';

describe('wpt.fyi button', () => {
  const runs = { firefox: { id: 2, version: '158.0', os: 'linux' }, safari: { id: 3, version: '27.0 (22625.1.29.11.27)', os: 'mac' }, chrome: { id: 1, version: '155.0.8059.84', os: 'linux' } };
  const fetchSpec: WptSpec = {
    paths: ['cors', 'fetch'],
    exclude: ['fetch/local-network-access', 'fetch/metadata'],
    all: { tests: 871, pass: { firefox: [10221, 11321], safari: [10185, 11344], chrome: [10669, 11304] }, interop: 75.1, only: { firefox: 69, safari: 86, chrome: 45 } },
    dirs: [
      ['cors', { tests: 27, pass: { firefox: [459, 463], safari: [441, 463], chrome: [463, 463] }, interop: 91.2, only: { firefox: 0, safari: 2, chrome: 0 } }],
      ['fetch', { tests: 844, pass: { firefox: [9762, 10858], safari: [9744, 10881], chrome: [10206, 10841] }, interop: 74.5, only: { firefox: 69, safari: 84, chrome: 45 } }],
    ],
  };
  const battery: WptSpec = { paths: ['battery-status'], all: { tests: 17, pass: { firefox: [12, 65], safari: [12, 65], chrome: [59, 65] }, interop: 1.8, only: { firefox: 0, safari: 0, chrome: 0 } } };
  const answer = (spec: WptSpec, more: Partial<WptAnswer> = {}): WptAnswer => ({ spec, runs, revision: '23b0b89b1a', date: '2026-10-18', ...more });
  const mdn = { count: 1, overviews: [], sections: [{ name: 'Interfaces', items: [{ title: 'Request', url: 'https://developer.mozilla.org/docs/Web/API/Request', children: [], count: 0 }] }], content: { commit: 'a'.repeat(40), date: '2026-10-18' } };
  const caniuse = { features: [{ id: 'fetch', title: 'Fetch', usage: 97, notes: {}, runs: { firefox: [], safari: [], chrome: [] } }], source: { version: 'v', updated: '2026-10-13' } };
  const impl = {
    engines: ['webkit', 'blink'], basis: 'shared', core: 2, ships: { gecko: 0, webkit: 2, blink: 2 },
    lacks: { gecko: { features: [{ key: 'api.A' }], more: 0 } }, bcd: { version: '8.1.6', timestamp: '2026-10-15T10:11:12.000Z' },
  };
  const answerAll = (wpt: WptAnswer | null, more: { mdn?: unknown; caniuse?: unknown; impl?: unknown } = {}) =>
    sendMock.mockImplementation(async (type: string) =>
      type === 'get-wpt' ? { wpt } : type === 'get-caniuse' ? { caniuse: more.caniuse ?? null } : type === 'get-mdn' ? { mdn: more.mdn ?? null } : type === 'get-implementations' ? { impl: more.impl ?? null } : {});
  const label = 'Interop 75.1% across 871 tests on wpt.fyi';

  it('shows the logo and the interop score after the Can I Use button', async () => {
    answerAll(answer(fetchSpec), { mdn, caniuse });
    render(<CardRow shortname="fetch" />);
    const button = await screen.findByRole('button', { name: label });
    await screen.findByRole('button', { name: '1 Can I Use feature' });
    expect(button.textContent).toBe('75%');
    expect(button.getAttribute('title')).toBe(label);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('wpt-list');
    const logo = button.querySelector('img')!;
    expect([logo.getAttribute('src'), logo.getAttribute('alt')]).toEqual(['icons/wpt.svg', '']);
    expect([...button.parentElement!.children].map((c) => c.getAttribute('aria-controls'))).toEqual(['mdn-list', 'caniuse-list', 'wpt-list']);
  });

  it("renders the table only once it's first opened, with a row for all tests and for each directory", async () => {
    answerAll(answer(fetchSpec));
    render(<CardRow shortname="fetch" />);
    const button = await screen.findByRole('button', { name: label });
    const panel = document.getElementById('wpt-list')!;
    expect([panel.hidden, panel.innerHTML]).toEqual([true, '']);
    fireEvent.click(button);
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('caption')!.textContent).toBe('871 tests % of subtests passing');
    const cols = [...panel.querySelectorAll('thead th')];
    expect(cols.map((th) => th.querySelector('img')?.getAttribute('alt') ?? th.textContent)).toEqual(['Firefox', 'Safari', 'Chrome', 'Interop']);
    expect(cols.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    const rows = [...panel.querySelectorAll('tbody tr')];
    expect(rows.map((tr) => [tr.querySelector('th')!.getAttribute('scope'), tr.querySelector('th')!.textContent])).toEqual([['row', 'All tests 871'], ['row', 'cors/ 27'], ['row', 'fetch/ 844']]);
    expect(rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent))).toEqual([['90.3', '89.8', '94.4', '75.1'], ['99.1', '95.2', '100', '91.2'], ['89.9', '89.6', '94.1', '74.5']]);
    expect([...rows[1].querySelectorAll('td')].map((td) => td.className)).toEqual(['hi', 'hi', 'hi', 'mid']);
    expect([...rows[0].querySelectorAll('td')].map((td) => td.getAttribute('title'))).toEqual([
      '10,221 of 11,321 subtests', '10,185 of 11,344 subtests', '10,669 of 11,304 subtests', 'Interop: each test\u2019s lowest pass rate of the three, averaged over the tests',
    ]);
    expect(rows[0].className).toBe('total');
    expect(screen.getByRole('link', { name: 'All tests' }).getAttribute('href')).toBe(allUrl(fetchSpec, runs));
    expect(screen.getByRole('link', { name: 'fetch/' }).getAttribute('href')).toBe(dirUrl(fetchSpec, 'fetch', runs));
    const only = panel.querySelector('.wpt-only')!;
    expect(only.textContent!.startsWith('Fail in only one browser:')).toBe(true);
    expect([...only.querySelectorAll('a')].map((a) => [a.querySelector('img')!.getAttribute('alt'), a.textContent, a.getAttribute('href'), a.getAttribute('title')])).toEqual([
      ['Firefox', '69', onlyUrl(fetchSpec, 'firefox', runs), 'Tests where Firefox fails something Safari and Chrome pass'],
      ['Safari', '86', onlyUrl(fetchSpec, 'safari', runs), 'Tests where Safari fails something Firefox and Chrome pass'],
      ['Chrome', '45', onlyUrl(fetchSpec, 'chrome', runs), 'Tests where Chrome fails something Firefox and Safari pass'],
    ]);
    const credit = screen.getByRole('link', { name: 'wpt.fyi' });
    expect(credit.getAttribute('href')).toBe('https://wpt.fyi/');
    expect(credit.closest('p')!.textContent).toBe('From wpt.fyi: stable Firefox 158 and Chrome 155 on Linux, Safari 27 on macOS, at WPT 23b0b89b1a, 18 October 2026.');
  });

  it('shows just All tests for a spec with one directory, and no fails-only line when every count is zero', async () => {
    answerAll(answer(battery));
    render(<CardRow shortname="battery-status" />);
    const button = await screen.findByRole('button', { name: 'Interop 1.8% across 17 tests on wpt.fyi' });
    expect(button.textContent).toBe('2%');
    fireEvent.click(button);
    expect([...document.querySelectorAll('#wpt-list tbody th')].map((th) => th.textContent)).toEqual(['All tests 17']);
    expect(screen.getByRole('link', { name: 'All tests' }).getAttribute('href')).toBe('https://wpt.fyi/results/battery-status?run_id=1&run_id=2&run_id=3');
    expect(document.querySelector('.wpt-only')).toBeNull();
  });

  it('writes a fails-only count of a thousand or more with a thousands separator', async () => {
    answerAll(answer({ ...battery, all: { ...battery.all, only: { firefox: 1234, safari: 0, chrome: 0 } } }));
    render(<CardRow shortname="battery-status" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Interop 1.8% across 17 tests on wpt.fyi' }));
    expect([...document.querySelectorAll('.wpt-only a')].map((a) => a.textContent)).toEqual(['1,234', '0', '0']);
  });

  it("says when the results are the series' current level's", async () => {
    answerAll(answer(fetchSpec, { fromSeries: { shortname: 'fetch-2', title: 'Fetch Level 2' } }));
    render(<CardRow shortname="fetch-1" />);
    fireEvent.click(await screen.findByRole('button', { name: label }));
    expect(screen.getByText('This spec has no test results of its own, so these are the ones for Fetch Level 2.')).toBeTruthy();
  });

  it("opens one of the row's four panels at a time", async () => {
    answerAll(answer(fetchSpec), { mdn, caniuse, impl });
    render(<CardRow shortname="fetch" />);
    const missing = await screen.findByRole('button', { name: 'What\u2019s missing?' });
    const wpt = await screen.findByRole('button', { name: label });
    const ciu = await screen.findByRole('button', { name: '1 Can I Use feature' });
    const shown = () => ['impl-why', 'mdn-list', 'caniuse-list', 'wpt-list'].filter((id) => !document.getElementById(id)!.hidden);
    fireEvent.click(wpt);
    expect(shown()).toEqual(['wpt-list']);
    fireEvent.click(missing);
    expect(shown()).toEqual(['impl-why']);
    fireEvent.click(ciu);
    expect(shown()).toEqual(['caniuse-list']);
    fireEvent.click(wpt);
    fireEvent.click(wpt);
    expect(shown()).toEqual([]);
  });

  it('shows no wpt.fyi button when the spec has no test results', async () => {
    answerAll(null, { mdn });
    render(<CardRow shortname="fetch" />);
    await screen.findByRole('button', { name: '1 MDN article' });
    expect(screen.queryByRole('button', { name: /wpt.fyi/ })).toBeNull();
    expect(document.getElementById('wpt-list')).toBeNull();
  });
});

import { ContextView } from '../src/ui/components/ContextView.tsx';
import { Search } from '../src/ui/components/Search.tsx';

describe('the popup with no page to show', () => {
  it('says which pages it shows something for', () => {
    render(<ContextView ctx={null} slots={{}} />);
    expect(document.querySelector('.empty')?.textContent).toBe(
      'Open a web spec, a W3C repository on GitHub, or a w3.org group page to see all that\u2019s known about it.');
  });

  it('labels its search box for web specs', () => {
    render(<Search />);
    expect(screen.getByLabelText('Search web specs')).toBeTruthy();
  });
});
