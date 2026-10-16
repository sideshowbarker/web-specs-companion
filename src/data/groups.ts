import type { RepoMap, SlimGroup, SlimSpec } from '../shared/types.ts';
import { parseGroupUrl } from '../shared/url.ts';

const nameKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

export function groupPageUrl(g: SlimGroup): string {
  return `https://www.w3.org/groups/${g.identifier}/`;
}

export class GroupIndex {
  readonly groups: SlimGroup[];
  private repos: RepoMap;
  private byId = new Map<string, SlimGroup>();
  private byNameKey = new Map<string, SlimGroup>();

  constructor(groups: SlimGroup[], repos: RepoMap) {
    this.groups = groups;
    this.repos = repos;
    for (const g of groups) {
      this.byId.set(g.identifier, g);
      this.byNameKey.set(nameKey(g.name), g);
    }
  }

  byIdentifier(identifier: string) {
    return this.byId.get(identifier);
  }

  byName(name: string) {
    return this.byNameKey.get(nameKey(name));
  }

  byUrl(url: string) {
    const id = parseGroupUrl(url);
    return id ? this.byId.get(id) : undefined;
  }

  forRepo(nwo: string): SlimGroup[] {
    return (this.repos.repos[nwo.toLowerCase()] ?? [])
      .map((id) => this.byId.get(id))
      .filter((g): g is SlimGroup => !!g);
  }

  forSpec(spec: SlimSpec): SlimGroup[] {
    const out: SlimGroup[] = [];
    for (const g of spec.groups) {
      const hit = this.byUrl(g.url) ?? this.byName(g.name);
      if (hit && !out.includes(hit)) out.push(hit);
    }
    return out;
  }
}
