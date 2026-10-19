import { DAY, HOUR, MINUTE } from '../data/urls.ts';
import { TPAC_TZ } from '../data/tpac.ts';
import type { Context } from '../shared/types.ts';

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

const hm = (ms: number, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(ms));

export function formatTpacTime(ms: number, localTz = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TPAC_TZ }).format(new Date(ms));
  const dublin = hm(ms, TPAC_TZ);
  const local = hm(ms, localTz);
  return `${day.replace(/,/g, '')}, ${dublin} Dublin${local === dublin ? '' : ` (${local} your time)`}`;
}

export function relativeAge(fetchedAt: number, now: number): string {
  const d = Math.max(0, now - fetchedAt);
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
  if (d < MINUTE) return 'just now';
  if (d < HOUR) return unit(Math.floor(d / MINUTE), 'minute');
  if (d < DAY) return unit(Math.floor(d / HOUR), 'hour');
  return unit(Math.floor(d / DAY), 'day');
}

export function charterWarning(endDate: string | undefined, now: number): string | undefined {
  if (!endDate) return undefined;
  const days = Math.ceil((Date.parse(`${endDate}T00:00:00Z`) - now) / DAY);
  if (days < 0) return `Charter ended ${formatDate(endDate)}`;
  if (days <= 90) return `Charter ends ${formatDate(endDate)}, in ${days} day${days === 1 ? '' : 's'}`;
  return undefined;
}

export function specLinks(ctx: Context): { label: string; href: string }[] {
  const s = ctx.spec;
  const f = ctx.facts;
  const out: { label: string; href: string }[] = [];
  const ed = s?.nightly?.url ?? f?.edUrl;
  if (ed) out.push({ label: 'Editor\u2019s Draft', href: ed });
  const tr = s?.release?.url ?? f?.latestUrl;
  if (tr) out.push({ label: 'Latest TR version', href: tr });
  if (s?.release && s.organization.startsWith('W3C')) {
    out.push({ label: 'Publication history', href: `https://www.w3.org/standards/history/${s.shortname}/` });
  }
  const repo = (s?.nightly?.repository ?? f?.repoUrl)?.replace(/\/$/, '');
  if (repo) {
    out.push({ label: 'Repository', href: repo });
    out.push({ label: 'Open issues', href: `${repo}/issues` });
    out.push({ label: 'File an issue', href: `${repo}/issues/new/choose` });
  }
  const t = s?.tests;
  if (t?.repository === 'https://github.com/web-platform-tests/wpt' && t.testPaths?.[0]) {
    out.push({ label: 'Tests', href: `https://wpt.fyi/results/${t.testPaths[0]}` });
  }
  return out;
}
