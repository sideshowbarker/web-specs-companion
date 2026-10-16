import { describe, it, expect } from 'vitest';
import { statusCode, badgeColor, maturityFor } from '../src/logic/maturity.ts';
import { specs } from './fixtures/catalog.ts';
import type { Context } from '../src/shared/types.ts';

describe('statusCode', () => {
  it.each([
    ["Editor's Draft", 'ED'], ['Working Draft', 'WD'], ['Candidate Recommendation Draft', 'CRD'],
    ['Candidate Recommendation Snapshot', 'CRS'], ['Recommendation', 'REC'], ['Group Note', 'NOTE'],
    ['Draft Community Group Report', 'CG'], ['Living Standard', 'LS'], ['WD', 'WD'], ['CG-DRAFT', 'CG'],
    ['unofficial', 'UD'], ['Retired', 'RET'],
  ])('%s -> %s', (status, code) => expect(statusCode(status)).toBe(code));
  it('returns undefined for unknown or missing statuses', () => {
    expect(statusCode('Banana')).toBeUndefined();
    expect(statusCode(undefined)).toBeUndefined();
  });
});

describe('maturityFor', () => {
  const ctx = (over: Partial<Context>): Context => ({ kind: 'spec', url: 'https://x/', groups: [], ...over });
  it("uses the page's own status first", () => {
    expect(maturityFor(ctx({ spec: specs[0], pageKind: 'tr', facts: { kind: 'spec', url: 'x', status: 'CRD' } }))).toBe('CRD');
  });
  it('uses the release status on TR pages and the nightly status on drafts', () => {
    expect(maturityFor(ctx({ spec: specs[0], pageKind: 'tr' }))).toBe('WD');
    expect(maturityFor(ctx({ spec: specs[0], pageKind: 'ed' }))).toBe('ED');
    expect(maturityFor(ctx({ spec: specs[5], pageKind: 'ed' }))).toBe('LS');
  });
  it('shows nothing outside spec pages', () => {
    expect(maturityFor(ctx({ kind: 'repo' }))).toBeUndefined();
  });
});

describe('badgeColor', () => {
  it('gives every code a color', () => {
    for (const c of ['ED', 'WD', 'CRD', 'CR', 'CRS', 'PR', 'REC', 'NOTE', 'CG', 'LS', 'UD', 'DISC', 'RET', 'TR']) {
      expect(badgeColor(c)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
