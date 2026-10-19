// Works out, from caniuse's own data (caniuse-db), each caniuse feature's support history in desktop Firefox, Safari,
// and Chrome, as runs of versions with the same support, and which specs in browser-specs each feature belongs to.
import type { SlimSpec } from '../shared/types.ts';
import { matchSpecUrl, specUrlIndex } from './implementations.ts';

export type Support = 'y' | 'a' | 'n' | 'u';
export type CiuBrowser = 'firefox' | 'safari' | 'chrome';
export const CIU_BROWSERS: readonly CiuBrowser[] = ['firefox', 'safari', 'chrome'];

export interface CiuRun {
  from: string; // the run's first version, e.g. '42'; caniuse's own version strings, such as '18.5-18.7' or 'TP'
  to: string; // its last version
  support: Support;
  flag?: true; // caniuse's d: Behind a flag
  prefix?: true; // caniuse's x: Needs a prefix
  notes?: number[]; // the note numbers the run cites
  month?: string; // YYYY-MM its first version was released; betas have none
  current?: true; // the run that holds the current release
  beta?: true;
}

export interface CiuFeature {
  title: string;
  usage: number; // global support, all browsers, in percent
  runs: Record<CiuBrowser, CiuRun[]>; // oldest first
  notes: Record<string, string>; // only those a partial or flagged run cites
}

export interface CiuFile {
  caniuse: { version: string; updated: string }; // caniuse-db's npm version, and its data's update date as YYYY-MM-DD
  features: Record<string, CiuFeature>; // by caniuse ID
  specs: Record<string, string[]>; // by browser-specs shortname: caniuse IDs, sorted
}

// One of a browser's versions, as caniuse-db lists them, in order.
export interface CiuVersion {
  version: string;
  release_date?: number | null; // seconds since the epoch
  era: number; // below 0 for past releases, 0 for the current one, above 0 for betas
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => ([] as unknown[]).concat(v ?? []).filter((s): s is string => typeof s === 'string');

// Reads a support code such as 'a x #2 #3'. A polyfill's p counts as n, since the history is about the engine.
function parseCode(code: string): Pick<CiuRun, 'support' | 'flag' | 'prefix' | 'notes'> {
  const parts = code.trim().split(/\s+/);
  const first = parts[0];
  const support: Support = first === 'y' ? 'y' : first === 'a' ? 'a' : first === 'n' || first === 'p' ? 'n' : 'u';
  const notes = parts.filter((p) => /^#\d+$/.test(p)).map((p) => Number(p.slice(1)));
  return {
    support,
    ...(parts.includes('d') ? { flag: true as const } : {}),
    ...(parts.includes('x') ? { prefix: true as const } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };
}

// Groups a browser's versions into runs of the same support code. The current release ends the past runs (a past run
// with the same code merges into the current one), and betas form runs of their own.
export function buildRuns(versions: CiuVersion[], stats: Record<string, unknown>): CiuRun[] {
  const runs: CiuRun[] = [];
  let last: { code: string; phase: number } | undefined;
  for (const v of versions) {
    const code = typeof stats[v.version] === 'string' ? (stats[v.version] as string) : 'u';
    const phase = Math.sign(v.era);
    const run = runs[runs.length - 1];
    if (run && last && last.code === code && (last.phase === phase || (last.phase === -1 && phase === 0))) {
      run.to = v.version;
      if (phase === 0) run.current = true;
      last.phase = phase;
      continue;
    }
    const next: CiuRun = { from: v.version, to: v.version, ...parseCode(code) };
    if (phase < 1 && typeof v.release_date === 'number') next.month = new Date(v.release_date * 1000).toISOString().slice(0, 7);
    if (phase === 0) next.current = true;
    if (phase === 1) next.beta = true;
    runs.push(next);
    last = { code, phase };
  }
  return runs;
}

// Builds the Can I Use file. A caniuse feature belongs to a spec when its own spec URL matches the spec, or when the
// spec URL of a web-features feature that lists its caniuse ID does. Of a feature's notes, it keeps just the ones that
// a partial or flagged run cites.
export function buildCaniuse(caniuse: unknown, webFeatures: unknown, specs: SlimSpec[], version: string): CiuFile {
  const c = isObject(caniuse) ? caniuse : {};
  const agents = isObject(c.agents) ? c.agents : {};
  const data = isObject(c.data) ? c.data : {};
  const index = specUrlIndex(specs);
  const viaWebFeatures = new Map<string, string[]>();
  const wf = isObject(webFeatures) && isObject(webFeatures.features) ? webFeatures.features : {};
  for (const f of Object.values(wf)) {
    if (!isObject(f) || (f.kind !== undefined && f.kind !== 'feature')) continue;
    for (const id of strings(f.caniuse)) viaWebFeatures.set(id, [...(viaWebFeatures.get(id) ?? []), ...strings(f.spec)]);
  }
  const versionsOf = (b: CiuBrowser): CiuVersion[] => {
    const a = agents[b];
    return isObject(a) && Array.isArray(a.version_list) ? (a.version_list as CiuVersion[]) : [];
  };
  const features: Record<string, CiuFeature> = {};
  const bySpec = new Map<string, string[]>();
  for (const id of Object.keys(data).sort()) {
    const f = data[id];
    if (!isObject(f)) continue;
    const urls = [...strings(f.spec), ...(viaWebFeatures.get(id) ?? [])];
    const shortnames = new Set(urls.map((u) => matchSpecUrl(index, u)).filter((s): s is string => s !== undefined));
    if (shortnames.size === 0) continue;
    const stats = isObject(f.stats) ? f.stats : {};
    const runs = Object.fromEntries(
      CIU_BROWSERS.map((b) => [b, buildRuns(versionsOf(b), isObject(stats[b]) ? stats[b] : {})]),
    ) as Record<CiuBrowser, CiuRun[]>;
    const cited = new Set(CIU_BROWSERS.flatMap((b) => runs[b].filter((r) => r.support !== 'y' || r.flag).flatMap((r) => r.notes ?? [])));
    const all = isObject(f.notes_by_num) ? f.notes_by_num : {};
    const notes: Record<string, string> = {};
    for (const n of [...cited].sort((a, b) => a - b)) if (typeof all[n] === 'string') notes[n] = all[n] as string;
    const usage = Math.round(((Number(f.usage_perc_y) || 0) + (Number(f.usage_perc_a) || 0)) * 10) / 10;
    features[id] = { title: typeof f.title === 'string' ? f.title : id, usage, runs, notes };
    for (const s of shortnames) bySpec.set(s, [...(bySpec.get(s) ?? []), id]);
  }
  const out: Record<string, string[]> = {};
  for (const s of [...bySpec.keys()].sort()) out[s] = bySpec.get(s)!;
  const updated = typeof c.updated === 'number' ? new Date(c.updated * 1000).toISOString().slice(0, 10) : '';
  return { caniuse: { version, updated }, features, specs: out };
}
