import { type SpecIndex, specRef } from '../data/specs.ts';
import type { SpecDetails } from '../data/w3capi.ts';
import type { Context, SpecRef } from '../shared/types.ts';

export type RadarNote =
  | { kind: 'latest-tr'; url: string }
  | { kind: 'newer-level'; spec: SpecRef }
  | { kind: 'obsolete'; by: SpecRef[] }
  | { kind: 'delta'; base: SpecRef }
  | { kind: 'tr-lag'; months: number; trDate: string; edDate: string }
  | { kind: 'behind-ed'; months: number; edDate: string; edUrl: string };

export interface Radar {
  label: string;
  notes: RadarNote[];
}

const LAG_MONTHS = 6;

function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0);
}

export function computeRadar(ctx: Context, specs: SpecIndex, details?: SpecDetails, draftDate?: string): Radar | undefined {
  const s = ctx.spec;
  if (ctx.kind !== 'spec' || !s) return undefined;
  const label =
    ctx.pageKind === 'dated-tr' ? 'Dated snapshot'
    : ctx.pageKind === 'tr' ? 'Latest TR version'
    : ctx.pageKind === 'history' ? 'Publication history'
    : s.nightly?.status === 'Living Standard' ? 'Living Standard'
    : 'Editor\u2019s Draft';

  const notes: RadarNote[] = [];
  if (ctx.pageKind === 'dated-tr' && s.release?.url) notes.push({ kind: 'latest-tr', url: s.release.url });
  const next = s.seriesNext ? specs.get(s.seriesNext) : undefined;
  if (next) notes.push({ kind: 'newer-level', spec: specRef(next) });
  const obsoletedBy = (s.obsoletedBy ?? []).map((n) => specs.get(n)).filter((x) => !!x).map((x) => specRef(x!));
  if (obsoletedBy.length) notes.push({ kind: 'obsolete', by: obsoletedBy });
  const prev = s.seriesComposition === 'delta' && s.seriesPrevious ? specs.get(s.seriesPrevious) : undefined;
  if (prev) notes.push({ kind: 'delta', base: specRef(prev) });
  const edDate = ctx.facts?.date;
  if (ctx.pageKind === 'ed' && edDate && details?.trDate) {
    const months = monthsBetween(details.trDate, edDate);
    if (months >= LAG_MONTHS) notes.push({ kind: 'tr-lag', months, trDate: details.trDate, edDate });
  }
  if (ctx.pageKind === 'tr' && draftDate && details?.trDate && s.nightly?.url) {
    const months = monthsBetween(details.trDate, draftDate);
    if (months >= LAG_MONTHS) notes.push({ kind: 'behind-ed', months, edDate: draftDate, edUrl: s.nightly.url });
  }
  return { label, notes };
}
