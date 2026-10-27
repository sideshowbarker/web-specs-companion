import { describe, it, expect } from 'vitest';
import { charterWarning, formatDate, formatTpacTime, relativeAge, specLinks, titleHref } from '../src/ui/format.ts';
import { specs } from './fixtures/catalog.ts';

const at = (iso: string) => Date.parse(iso);

describe('formatDate', () => {
  it('spells out the month', () => expect(formatDate('2026-10-30')).toBe('30 October 2026'));
});

describe('formatTpacTime', () => {
  it('shows Dublin time, plus local time when it differs', () => {
    expect(formatTpacTime(at('2026-10-26T09:00:00Z'), 'Asia/Tokyo')).toBe('Mon 26 Oct, 09:00 Dublin (18:00 your time)');
    expect(formatTpacTime(at('2026-10-26T09:00:00Z'), 'Europe/Dublin')).toBe('Mon 26 Oct, 09:00 Dublin');
    expect(formatTpacTime(at('2026-10-26T09:00:00Z'), 'Europe/London')).toBe('Mon 26 Oct, 09:00 Dublin');
  });
});

describe('relativeAge', () => {
  it('reads naturally', () => {
    const now = at('2026-10-16T12:00:00Z');
    expect(relativeAge(now - 20_000, now)).toBe('just now');
    expect(relativeAge(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(relativeAge(now - 60 * 60_000, now)).toBe('1 hour ago');
    expect(relativeAge(now - 3 * 86_400_000, now)).toBe('3 days ago');
  });
});

describe('charterWarning', () => {
  const now = at('2026-10-16T00:00:00Z');
  it('warns within 90 days and after the end', () => {
    expect(charterWarning('2026-10-30', now)).toBe('Charter ends 30 October 2026, in 14 days');
    expect(charterWarning('2026-10-01', now)).toBe('Charter ended 1 October 2026');
    expect(charterWarning('2027-11-30', now)).toBeUndefined();
    expect(charterWarning(undefined, now)).toBeUndefined();
  });
});

describe('specLinks', () => {
  it('lists the draft, history, the repo and its issues, and tests, but not the TR the title links', () => {
    const links = specLinks({ kind: 'spec', url: 'x', groups: [], spec: { ...specs[0], tests: { repository: 'https://github.com/web-platform-tests/wpt', testPaths: ['fetch/metadata'] } } });
    expect(links.map((l) => l.label)).toEqual([
      'Editor\u2019s Draft', 'Publication history', 'Repository', 'Open issues', 'File an issue', 'Tests',
    ]);
    expect(links.find((l) => l.label === 'Tests')?.href).toBe('https://wpt.fyi/results/fetch/metadata');
  });

  it("lists the TR but not the draft when the title links the draft", () => {
    const links = specLinks({ kind: 'spec', url: 'x', groups: [], spec: { ...specs[0], url: specs[0].nightly!.url } });
    expect(links.map((l) => l.label).slice(0, 2)).toEqual(['Latest TR version', 'Publication history']);
  });

  it("lists no draft for a page that is its own draft, which the title links when there's no spec", () => {
    const url = 'https://example.test/draft/';
    const links = specLinks({ kind: 'spec', url, groups: [], facts: { kind: 'spec', url, edUrl: url, latestUrl: 'https://example.test/tr/' } });
    expect(titleHref({ kind: 'spec', url, groups: [] })).toBe(url);
    expect(links.map((l) => l.label)).toEqual(['Latest TR version']);
  });
});
