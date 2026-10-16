import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { eventsForGroup, nowAndNext, parseIcs, tpacVisible, zonedToUtc } from '../src/data/tpac.ts';

const ics = readFileSync(new URL('./fixtures/tpac.ics', import.meta.url), 'utf8');
const events = parseIcs(ics);
const at = (iso: string) => Date.parse(iso);

describe('zonedToUtc', () => {
  it('handles Dublin summer time and the 25 October clock change', () => {
    expect(zonedToUtc(2026, 10, 24, 9, 0, 0, 'Europe/Dublin')).toBe(at('2026-10-24T08:00:00Z'));
    expect(zonedToUtc(2026, 10, 25, 9, 0, 0, 'Europe/Dublin')).toBe(at('2026-10-25T09:00:00Z'));
    expect(zonedToUtc(2026, 10, 26, 9, 0, 0, 'Europe/Dublin')).toBe(at('2026-10-26T09:00:00Z'));
    expect(zonedToUtc(2026, 10, 28, 9, 0, 0, 'Etc/UTC')).toBe(at('2026-10-28T09:00:00Z'));
  });
});

describe('parseIcs', () => {
  it('reads group meetings with their group, room, and event page', () => {
    const g = events.find((e) => e.uid === 'group-1');
    expect(g).toEqual({
      uid: 'group-1',
      title: 'Web Application Security Working Group',
      start: at('2026-10-26T09:00:00Z'),
      end: at('2026-10-26T12:00:00Z'),
      room: 'Ground Floor - Munster Suite',
      url: 'https://www.w3.org/events/meetings/group-1/',
      kind: 'group',
      groupName: 'Web Application Security Working Group',
    });
  });

  it('unescapes text and classifies breakouts', () => {
    const b = events.find((e) => e.uid === 'breakout-1');
    expect(b?.title).toBe('Action Semantics for Agents, Revisited');
    expect(b?.kind).toBe('breakout');
  });

  it('skips cancelled events and reads UTC times', () => {
    expect(events.some((e) => e.uid.startsWith('cancelled-1'))).toBe(false);
    expect(events.find((e) => e.uid === 'utc-1')?.start).toBe(at('2026-10-28T09:00:00Z'));
  });

  it('expands daily recurrence in local time and applies overrides', () => {
    const lounge = events.filter((e) => e.uid.startsWith('lounge')).map((e) => new Date(e.start).toISOString());
    expect(lounge).toEqual(['2026-10-24T08:00:00.000Z', '2026-10-25T10:00:00.000Z', '2026-10-26T09:00:00.000Z']);
  });
});

describe('nowAndNext', () => {
  it("lists what's in session and what starts within two hours", () => {
    const r = nowAndNext(events, at('2026-10-26T10:00:00Z'));
    expect(r.now.map((e) => e.title)).toEqual(['Remote participant virtual lounge', 'Web Application Security Working Group']);
    expect(r.next).toEqual([]);
    const later = nowAndNext(events, at('2026-10-26T15:30:00Z'));
    expect(later.now.map((e) => e.title)).toEqual(['Remote participant virtual lounge']);
    expect(later.next.map((e) => e.uid)).toEqual(['breakout-1']);
  });
});

describe('eventsForGroup', () => {
  it('matches group names loosely', () => {
    expect(eventsForGroup(events, '  web application security working group ').map((e) => e.uid)).toEqual(['group-1']);
  });
});

describe('tpacVisible', () => {
  it('is true from 19 October until the end of 30 October', () => {
    expect(tpacVisible(at('2026-10-18T23:59:00Z'))).toBe(false);
    expect(tpacVisible(at('2026-10-19T00:00:00Z'))).toBe(true);
    expect(tpacVisible(at('2026-10-30T23:59:00Z'))).toBe(true);
    expect(tpacVisible(at('2026-10-31T00:00:00Z'))).toBe(false);
  });
});
