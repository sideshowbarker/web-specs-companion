import type { GroupIndex } from '../data/groups.ts';
import type { SpecIndex, SpecMatch } from '../data/specs.ts';
import type { Context, PageFacts, SlimGroup } from '../shared/types.ts';
import { parseGitHubUrl, parseGroupUrl } from '../shared/url.ts';

function fromFacts(facts: PageFacts | undefined, specs: SpecIndex): SpecMatch | undefined {
  if (facts?.kind !== 'spec') return undefined;
  const byName = facts.shortname ? specs.get(facts.shortname) : undefined;
  if (byName) return { spec: byName, pageKind: 'unknown', others: [] };
  for (const u of [facts.latestUrl, facts.edUrl, facts.thisVersionUrl]) {
    const m = u ? specs.lookup(u) : undefined;
    if (m) return { ...m, pageKind: 'unknown' };
  }
  return undefined;
}

export function resolveContext(url: string, facts: PageFacts | undefined, specs: SpecIndex, groups: GroupIndex): Context {
  const gh = parseGitHubUrl(url);
  if (gh) {
    const nwo = facts?.github?.nwo ?? gh.nwo;
    return {
      kind: gh.kind,
      url,
      groups: groups.forRepo(nwo),
      repo: { nwo, url: `https://github.com/${nwo}`, number: gh.number },
      repoSpecs: specs.specsInRepo(nwo),
      facts,
    };
  }

  const gid = parseGroupUrl(url);
  if (gid) {
    const g = groups.byIdentifier(gid);
    return {
      kind: 'group',
      url,
      groups: g ? [g] : [],
      repoSpecs: g ? specs.specs.filter((s) => groups.forSpec(s).includes(g)) : [],
      facts,
    };
  }

  const match = specs.lookup(url) ?? fromFacts(facts, specs);
  if (match) {
    return {
      kind: 'spec',
      url,
      spec: match.spec,
      pageKind: match.pageKind,
      otherLevels: match.others,
      groups: groups.forSpec(match.spec),
      facts,
    };
  }

  if (facts?.kind === 'spec') {
    const fromPage = (facts.groupUrls ?? []).map((u) => groups.byUrl(u)).filter((g): g is SlimGroup => !!g);
    return { kind: 'spec', url, pageKind: 'unknown', groups: fromPage, facts };
  }
  return { kind: 'none', url, groups: [] };
}
