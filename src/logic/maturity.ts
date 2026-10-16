import type { Context } from '../shared/types.ts';

const BY_NAME: Record<string, string> = {
  "editor's draft": 'ED',
  'editor\u2019s draft': 'ED',
  'working draft': 'WD',
  'candidate recommendation draft': 'CRD',
  'candidate recommendation snapshot': 'CRS',
  'candidate recommendation': 'CR',
  'proposed recommendation': 'PR',
  recommendation: 'REC',
  note: 'NOTE',
  'group note': 'NOTE',
  'draft note': 'NOTE',
  statement: 'STMT',
  'draft community group report': 'CG',
  'final community group report': 'CG',
  'living standard': 'LS',
  'draft registry': 'REG',
  registry: 'REG',
  'discontinued draft': 'DISC',
  retired: 'RET',
  'unofficial proposal draft': 'UD',
};

const BY_CODE: Record<string, string> = {
  ED: 'ED', WD: 'WD', FPWD: 'WD', CR: 'CR', CRD: 'CRD', CRS: 'CRS', PR: 'PR', REC: 'REC', RSCND: 'RET',
  NOTE: 'NOTE', DNOTE: 'NOTE', 'NOTE-WD': 'NOTE', 'NOTE-ED': 'NOTE', STMT: 'STMT', DRY: 'REG', CRY: 'REG',
  'CG-DRAFT': 'CG', 'CG-FINAL': 'CG', 'BG-DRAFT': 'CG', 'BG-FINAL': 'CG', UD: 'UD', UNOFFICIAL: 'UD', LS: 'LS',
};

export function statusCode(status: string | undefined): string | undefined {
  if (!status) return undefined;
  return BY_NAME[status.trim().toLowerCase()] ?? BY_CODE[status.trim().toUpperCase()];
}

const COLORS: Record<string, string> = {
  ED: '#005a9c', WD: '#005a9c', LS: '#005a9c', TR: '#005a9c',
  CRD: '#1c6b3a', CR: '#1c6b3a', CRS: '#1c6b3a', PR: '#1c6b3a', REC: '#1c6b3a',
  NOTE: '#6b3fa0', STMT: '#6b3fa0', REG: '#6b3fa0',
  CG: '#555b61', UD: '#555b61',
  DISC: '#a4262c', RET: '#a4262c',
};

export function badgeColor(code: string): string {
  return COLORS[code] ?? '#555b61';
}

export function maturityFor(ctx: Context): string | undefined {
  if (ctx.kind !== 'spec') return undefined;
  const fromPage = statusCode(ctx.facts?.status);
  if (fromPage) return fromPage;
  const s = ctx.spec;
  if (!s) return undefined;
  if (ctx.pageKind === 'tr' || ctx.pageKind === 'dated-tr') return statusCode(s.release?.status) ?? 'TR';
  return statusCode(s.nightly?.status) ?? (s.organization === 'WHATWG' ? 'LS' : 'ED');
}
