import type { Loaded, TpacEvent } from '../shared/types.ts';
import { HOUR } from './urls.ts';

export const TPAC_TZ = 'Europe/Dublin';
export const TPAC_WINDOW = { from: Date.UTC(2026, 9, 19), until: Date.UTC(2026, 9, 31) };

export interface TpacView {
  visible: boolean;
  firstStart?: number;
  now: TpacEvent[];
  next: TpacEvent[];
  slots: Record<string, TpacEvent[]>;
  fetchedAt: number;
  origin: Loaded<unknown>['origin'];
}

export function tpacVisible(now: number): boolean {
  return now >= TPAC_WINDOW.from && now < TPAC_WINDOW.until;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function tzOffsetMs(utcMs: number, tz: string): number {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
}

export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = asIfUtc - tzOffsetMs(asIfUtc, tz);
  const second = asIfUtc - tzOffsetMs(first, tz);
  return second;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function splitOutsideQuotes(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const c of s) {
    if (c === '"') quoted = !quoted;
    if (c === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseLine(line: string): Prop | undefined {
  let quoted = false;
  let i = 0;
  for (; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ':' && !quoted) break;
  }
  if (i >= line.length) return undefined;
  const [name, ...rest] = splitOutsideQuotes(line.slice(0, i), ';');
  const params: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

const unescapeText = (v: string) => v.replace(/\\([\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

interface Stamp {
  parts: [number, number, number, number, number, number];
  tz?: string; // undefined = UTC
}

function stamp(p: Prop | undefined): Stamp | undefined {
  const m = p && /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(p.value);
  if (!m || !p) return undefined;
  const parts = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0', m[6] ?? '0'].map(Number) as Stamp['parts'];
  return { parts, tz: m[7] ? undefined : (p.params.TZID ?? TPAC_TZ) };
}

function toUtc(s: Stamp, dayOffset = 0): number {
  const [y, mo, d, h, mi, sec] = s.parts;
  if (!s.tz) return Date.UTC(y, mo - 1, d + dayOffset, h, mi, sec);
  const day = new Date(Date.UTC(y, mo - 1, d + dayOffset));
  return zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, mi, sec, s.tz);
}

type RawEvent = Map<string, Prop[]>;
const first = (e: RawEvent, name: string) => e.get(name)?.[0];

function toEvent(e: RawEvent, uid: string, start: number, end: number): TpacEvent | undefined {
  if (first(e, 'STATUS')?.value.toUpperCase() === 'CANCELLED') return undefined;
  const categories = (e.get('CATEGORIES') ?? []).flatMap((p) => p.value.split(','));
  const description = unescapeText(first(e, 'DESCRIPTION')?.value ?? '');
  const groupAttendee = (e.get('ATTENDEE') ?? []).find((p) => p.params.CUTYPE === 'GROUP' && p.params.CN);
  const kind = categories.includes('Group Meetings') ? 'group' : categories.includes('Breakout Sessions') ? 'breakout' : 'other';
  const ev: TpacEvent = {
    uid,
    title: unescapeText(first(e, 'SUMMARY')?.value ?? '').trim(),
    start,
    end,
    room: first(e, 'LOCATION') ? unescapeText(first(e, 'LOCATION')!.value) : undefined,
    url: /https:\/\/www\.w3\.org\/events\/meetings\/[^\s)]+/.exec(description)?.[0],
    kind,
  };
  if (kind === 'group' && groupAttendee) ev.groupName = groupAttendee.params.CN;
  return ev;
}

export function parseIcs(text: string): TpacEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const raw: RawEvent[] = [];
  let cur: RawEvent | undefined;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = new Map();
    else if (line === 'END:VEVENT') {
      if (cur) raw.push(cur);
      cur = undefined;
    } else if (cur) {
      const p = parseLine(line);
      if (p) cur.set(p.name, [...(cur.get(p.name) ?? []), p]);
    }
  }

  const overrides = new Map<string, RawEvent>();
  for (const e of raw) {
    const rid = stamp(first(e, 'RECURRENCE-ID'));
    if (rid) overrides.set(`${first(e, 'UID')?.value}|${toUtc(rid)}`, e);
  }

  const out: TpacEvent[] = [];
  for (const e of raw) {
    if (first(e, 'RECURRENCE-ID')) continue;
    const uid = first(e, 'UID')?.value ?? '';
    const s = stamp(first(e, 'DTSTART'));
    const en = stamp(first(e, 'DTEND'));
    if (!uid || !s) continue;
    const startUtc = toUtc(s);
    const duration = en ? toUtc(en) - startUtc : HOUR;
    const rrule = first(e, 'RRULE')?.value;
    if (!rrule) {
      const ev = toEvent(e, uid, startUtc, startUtc + duration);
      if (ev) out.push(ev);
      continue;
    }
    const rule = Object.fromEntries(rrule.split(';').map((kv) => kv.split('=')));
    if (rule.FREQ !== 'DAILY') continue;
    const interval = Number(rule.INTERVAL ?? 1);
    const until = rule.UNTIL ? toUtc(stamp({ name: 'UNTIL', params: {}, value: rule.UNTIL })!) : Infinity;
    const count = rule.COUNT ? Number(rule.COUNT) : 366;
    for (let k = 0, n = 0; n < count; k += interval, n++) {
      const occStart = toUtc(s, k);
      if (occStart > until) break;
      const override = overrides.get(`${uid}|${occStart}`);
      if (override) {
        const os = stamp(first(override, 'DTSTART'));
        const oe = stamp(first(override, 'DTEND'));
        if (!os) continue;
        const ev = toEvent(override, `${uid}@${occStart}`, toUtc(os), oe ? toUtc(oe) : toUtc(os) + duration);
        if (ev) out.push(ev);
      } else {
        const ev = toEvent(e, `${uid}@${occStart}`, occStart, occStart + duration);
        if (ev) out.push(ev);
      }
    }
  }
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

export function nowAndNext(events: TpacEvent[], now: number, windowMs = 2 * HOUR) {
  return {
    now: events.filter((e) => e.start <= now && now < e.end),
    next: events.filter((e) => e.start > now && e.start <= now + windowMs),
  };
}

const groupKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function eventsForGroup(events: TpacEvent[], groupName: string): TpacEvent[] {
  const k = groupKey(groupName);
  return events.filter((e) => e.kind === 'group' && e.groupName && groupKey(e.groupName) === k);
}
