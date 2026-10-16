export interface SlimSpec {
  shortname: string;
  title: string;
  shortTitle?: string;
  url: string;
  organization: string;
  standing: string;
  series: { shortname: string; currentSpecification: string; nightlyUrl?: string; releaseUrl?: string };
  seriesNext?: string;
  seriesPrevious?: string;
  seriesComposition?: string;
  nightly?: {
    url: string;
    status?: string;
    repository?: string;
    sourcePath?: string;
    alternateUrls: string[];
    pages?: string[];
  };
  release?: { url: string; status?: string; pages?: string[] };
  groups: { name: string; url: string }[];
  tests?: { repository: string; testPaths?: string[] };
  obsoletedBy?: string[];
  formerNames?: string[];
}

export interface SlimGroup {
  id: number;
  identifier: string; // e.g. 'wg/css'
  name: string;
  type: string; // e.g. 'working group'
  endDate?: string; // YYYY-MM-DD
}

/** Keys are lowercase 'owner/name'. */
export interface RepoMap {
  repos: Record<string, string[]>;
  /** Canonical casing of each owner login, keyed by lowercase login. */
  owners: Record<string, string>;
}

export type IdlNames = Record<string, { type: string }>;

export type PageKind = 'ed' | 'tr' | 'dated-tr' | 'history' | 'unknown';

export type Generator = 'bikeshed' | 'respec' | 'wattsi' | 'unknown';

export interface PageFacts {
  kind: 'spec' | 'github';
  url: string;
  generator?: Generator;
  title?: string;
  status?: string;
  shortname?: string;
  edUrl?: string;
  latestUrl?: string;
  thisVersionUrl?: string;
  historyUrl?: string;
  issuesUrl?: string;
  repoUrl?: string;
  groupUrls?: string[];
  date?: string; // YYYY-MM-DD
  revision?: string;
  outdatedBanner?: boolean;
  github?: { nwo: string; route?: string; number?: number };
}

export interface SpecRef {
  shortname: string;
  title: string;
  url: string;
}

export interface Context {
  kind: 'spec' | 'repo' | 'issue' | 'pr' | 'group' | 'none';
  url: string;
  spec?: SlimSpec;
  pageKind?: PageKind;
  otherLevels?: SlimSpec[];
  groups: SlimGroup[];
  repo?: { nwo: string; url: string; number?: number };
  repoSpecs?: SlimSpec[];
  groupRepos?: string[];
  facts?: PageFacts;
}

export interface TpacEvent {
  uid: string;
  title: string;
  start: number; // epoch ms
  end: number;
  room?: string;
  url?: string;
  kind: 'group' | 'breakout' | 'other';
  groupName?: string;
}

export interface Loaded<T> {
  data: T;
  fetchedAt: number;
  origin: 'live' | 'cache' | 'stale' | 'bundled';
}
