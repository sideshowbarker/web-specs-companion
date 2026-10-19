import { describe, it, expect } from 'vitest';
import { isoFromSpecDate } from '../src/data/webref.ts';

describe('isoFromSpecDate', () => {
  it('turns the date a spec shows, as webref records it, into an ISO date', () => {
    expect(isoFromSpecDate('02 February 2026')).toBe('2026-02-02');
    expect(isoFromSpecDate('6 October 2026')).toBe('2026-10-06');
  });

  it('returns undefined for a date in any other shape', () => {
    expect(isoFromSpecDate(undefined)).toBeUndefined();
    expect(isoFromSpecDate('2026-02-02')).toBeUndefined();
    expect(isoFromSpecDate('6 Octobre 2026')).toBeUndefined();
  });
});
