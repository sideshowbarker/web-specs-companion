import type { IdlNames, RepoMap, SlimGroup, SlimSpec } from '../shared/types.ts';

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
