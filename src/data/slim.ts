import type { IdlNames, RepoMap, SlimGroup, SlimSpec } from '../shared/types.ts';
import { isImplRecord, type ImplFile, type ImplRecord } from '../logic/implementations.ts';
import { isMdnPage, type MdnFile, type MdnPage } from '../logic/mdn.ts';
import { isCiuFeature, type CiuFile } from '../logic/caniuse.ts';

// Upstream records are untyped JSON; each slimmer reads only the fields it keeps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const strs = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;

export function slimSpecs(raw: unknown): SlimSpec[] {
  if (!Array.isArray(raw)) throw new Error('browser-specs: expected an array');
  return raw
    .filter((s: Raw) => s && typeof s.shortname === 'string' && typeof s.url === 'string')
    .map((s: Raw): SlimSpec => ({
      shortname: s.shortname,
      title: str(s.title) ?? s.shortname,
      shortTitle: str(s.shortTitle),
      url: s.url,
      organization: str(s.organization) ?? '',
      standing: str(s.standing) ?? 'good',
      series: {
        shortname: str(s.series?.shortname) ?? s.shortname,
        currentSpecification: str(s.series?.currentSpecification) ?? s.shortname,
        nightlyUrl: str(s.series?.nightlyUrl),
        releaseUrl: str(s.series?.releaseUrl),
      },
      seriesNext: str(s.seriesNext),
      seriesPrevious: str(s.seriesPrevious),
      seriesComposition: str(s.seriesComposition),
      nightly: str(s.nightly?.url)
        ? {
            url: s.nightly.url,
            status: str(s.nightly.status),
            repository: str(s.nightly.repository),
            sourcePath: str(s.nightly.sourcePath),
            alternateUrls: strs(s.nightly.alternateUrls) ?? [],
            pages: strs(s.nightly.pages),
          }
        : undefined,
      release: str(s.release?.url)
        ? { url: s.release.url, status: str(s.release.status), pages: strs(s.release.pages) }
        : undefined,
      groups: Array.isArray(s.groups)
        ? s.groups.filter((g: Raw) => str(g?.name) && str(g?.url)).map((g: Raw) => ({ name: g.name, url: g.url }))
        : [],
      tests: str(s.tests?.repository) ? { repository: s.tests.repository, testPaths: strs(s.tests.testPaths) } : undefined,
      obsoletedBy: strs(s.obsoletedBy),
      formerNames: strs(s.formerNames),
    }));
}

export function slimGroups(raw: unknown): SlimGroup[] {
  if (!Array.isArray(raw)) throw new Error('w3c-groups: expected an array');
  return raw
    .filter((g: Raw) => g && !g.is_closed && typeof g.identifier === 'string' && typeof g.id === 'number')
    .map((g: Raw): SlimGroup => ({
      id: g.id,
      identifier: g.identifier,
      name: str(g.name) ?? g.identifier,
      type: str(g.type) ?? '',
      endDate: str(g['end-date']),
    }));
}

export function slimRepos(raw: unknown): RepoMap {
  if (!Array.isArray(raw)) throw new Error('repositories: expected an array');
  const map: RepoMap = { repos: {}, owners: {} };
  for (const r of raw as Raw[]) {
    const login = str(r?.owner?.login);
    const name = str(r?.name);
    const groups = strs(r?.w3cjson?.group);
    if (!login || !name || !groups?.length || r.isPrivate) continue;
    map.repos[`${login}/${name}`.toLowerCase()] = groups;
    map.owners[login.toLowerCase()] = login;
  }
  return map;
}

export function slimIdlNames(raw: unknown): IdlNames {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('idlnames: expected an object');
  const out: IdlNames = {};
  for (const [name, v] of Object.entries(raw as Record<string, Raw>)) {
    if (typeof v?.type === 'string') out[name] = { type: v.type };
  }
  return out;
}

// Drops each record whose shape doesn't fit, so the card shows no row for that spec, rather than failing to render.
export function slimImplementations(raw: unknown): ImplFile {
  const r = raw as Raw;
  const specs = r?.specs;
  if (typeof r?.bcd?.version !== 'string' || typeof r.bcd.timestamp !== 'string' || !specs || typeof specs !== 'object' || Array.isArray(specs)) {
    throw new Error('implementations: expected bcd.version, bcd.timestamp, and specs');
  }
  const valid = Object.entries(specs as Record<string, unknown>).filter((entry): entry is [string, ImplRecord] => isImplRecord(entry[1]));
  return { bcd: { version: r.bcd.version, timestamp: r.bcd.timestamp }, specs: Object.fromEntries(valid) };
}

// Drops each page whose shape doesn't fit, each index that's out of range or names a dropped page, and each spec left
// with no pages, so the card lists what's left, rather than failing to render.
export function slimMdn(raw: unknown): MdnFile {
  const { content, types, pages, specs } = (raw ?? {}) as Raw;
  if (typeof content?.commit !== 'string' || typeof content.date !== 'string' || !Array.isArray(types) || !Array.isArray(pages)
    || !specs || typeof specs !== 'object' || Array.isArray(specs)) {
    throw new Error('mdn: expected content.commit, content.date, types, pages, and specs');
  }
  const kept: MdnPage[] = [];
  const at = new Map<number, number>();
  pages.forEach((page: unknown, i: number) => {
    if (!isMdnPage(page, types)) return;
    at.set(i, kept.length);
    kept.push([page[0], page[1], page[2]]);
  });
  const bySpec: Record<string, number[]> = {};
  for (const [shortname, ids] of Object.entries(specs as Record<string, unknown>)) {
    const valid = Array.isArray(ids) ? ids.filter((i) => at.has(i)).map((i) => at.get(i)!) : [];
    if (valid.length > 0) bySpec[shortname] = valid;
  }
  return { content: { commit: content.commit, date: content.date }, types, pages: kept, specs: bySpec };
}

// Drops each feature whose shape doesn't fit (whole, since a history missing a run would be wrong), each spec entry
// that names a dropped feature, and each spec left with none.
export function slimCaniuse(raw: unknown): CiuFile {
  const { caniuse, features, specs } = (raw ?? {}) as Raw;
  const isPlain = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (typeof caniuse?.version !== 'string' || typeof caniuse.updated !== 'string' || !isPlain(features) || !isPlain(specs)) {
    throw new Error('caniuse: expected caniuse.version, caniuse.updated, features, and specs');
  }
  const kept = Object.fromEntries(Object.entries(features as Record<string, unknown>).filter((e) => isCiuFeature(e[1]))) as CiuFile['features'];
  const bySpec = Object.fromEntries(
    Object.entries(specs as Record<string, unknown>).flatMap(([shortname, ids]) => {
      const valid = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && Object.hasOwn(kept, id)) : [];
      return valid.length > 0 ? [[shortname, valid]] : [];
    }),
  );
  return { caniuse: { version: caniuse.version, updated: caniuse.updated }, features: kept, specs: bySpec };
}
