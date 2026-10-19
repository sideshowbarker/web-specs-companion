import { describe, it, expect } from 'vitest';
import { SpecIndex } from '../src/data/specs.ts';
import { computeRadar } from '../src/logic/radar.ts';
import { specs } from './fixtures/catalog.ts';
import type { Context } from '../src/shared/types.ts';

const si = new SpecIndex(specs);
const ctx = (shortname: string, over: Partial<Context>): Context => ({ kind: 'spec', url: 'https://x/', groups: [], spec: si.get(shortname), ...over });

describe('computeRadar', () => {
  it('points a dated snapshot at the latest TR', () => {
    const r = computeRadar(ctx('fetch-metadata', { pageKind: 'dated-tr' }), si);
    expect(r?.label).toBe('Dated snapshot');
    expect(r?.notes).toContainEqual({ kind: 'latest-tr', url: 'https://www.w3.org/TR/fetch-metadata/' });
  });

  it('flags a newer level', () => {
    const r = computeRadar(ctx('wai-aria-1.2', { pageKind: 'tr' }), si);
    expect(r?.notes).toContainEqual({ kind: 'newer-level', spec: { shortname: 'wai-aria-1.3', title: 'WAI-ARIA 1.3', url: 'https://www.w3.org/TR/wai-aria-1.3/' } });
  });

  it('warns that a delta spec reads on top of the previous level', () => {
    const r = computeRadar(ctx('css-grid-3', { pageKind: 'ed' }), si);
    expect(r?.notes).toContainEqual({ kind: 'delta', base: { shortname: 'css-grid-2', title: 'CSS Grid Layout Module Level 2', url: 'https://www.w3.org/TR/css-grid-2/' } });
  });

  it('reports how far the latest TR lags the draft, from six months on', () => {
    const facts = { kind: 'spec' as const, url: 'https://x/', date: '2026-10-01' };
    const lagging = computeRadar(ctx('fetch-metadata', { pageKind: 'ed', facts }), si, { trDate: '2025-08-15' });
    expect(lagging?.notes).toContainEqual({ kind: 'tr-lag', months: 13, trDate: '2025-08-15', edDate: '2026-10-01' });
    const recent = computeRadar(ctx('fetch-metadata', { pageKind: 'ed', facts }), si, { trDate: '2026-09-21' });
    expect(recent?.notes.some((n) => n.kind === 'tr-lag')).toBe(false);
  });

  it('reports how far the latest TR is behind the draft webref crawled, from six months on', () => {
    const tr = ctx('fetch-metadata', { pageKind: 'tr' });
    expect(computeRadar(tr, si, { trDate: '2025-08-15' }, '2026-10-01')?.notes).toContainEqual(
      { kind: 'behind-ed', months: 13, edDate: '2026-10-01', edUrl: 'https://w3c.github.io/webappsec-fetch-metadata/' },
    );
    const behind = (r: ReturnType<typeof computeRadar>) => r?.notes.some((n) => n.kind === 'behind-ed');
    expect(behind(computeRadar(tr, si, { trDate: '2026-09-21' }, '2026-10-01'))).toBe(false);
    expect(behind(computeRadar(tr, si, { trDate: '2025-08-15' }))).toBe(false);
    expect(behind(computeRadar(ctx('fetch-metadata', { pageKind: 'ed' }), si, { trDate: '2025-08-15' }, '2026-10-01'))).toBe(false);
  });

  it('labels each page kind and returns nothing outside spec pages', () => {
    expect(computeRadar(ctx('fetch-metadata', { pageKind: 'ed' }), si)?.label).toBe('Editor\u2019s Draft');
    expect(computeRadar(ctx('fetch-metadata', { pageKind: 'tr' }), si)?.label).toBe('Latest TR version');
    expect(computeRadar(ctx('html', { pageKind: 'ed' }), si)?.label).toBe('Living Standard');
    expect(computeRadar({ kind: 'repo', url: 'x', groups: [] }, si)).toBeUndefined();
  });
});
