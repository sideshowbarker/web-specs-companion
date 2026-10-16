// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { specs, groups } from './fixtures/catalog.ts';

vi.mock('../src/ui/api.ts', () => ({ send: vi.fn(), sendToTab: vi.fn(), open: vi.fn(), activeTab: vi.fn() }));
vi.mock('../src/shared/settings.ts', () => ({ getSettings: vi.fn(async () => ({ usedBy: true })), setSettings: vi.fn(async () => {}) }));

import { send } from '../src/ui/api.ts';
import { SpecCard } from '../src/ui/components/SpecCard.tsx';
import { GroupBlock } from '../src/ui/components/GroupBlock.tsx';
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
