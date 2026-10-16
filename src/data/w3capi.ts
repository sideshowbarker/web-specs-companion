import type { Http } from './http.ts';
import { DAY, URLS } from './urls.ts';

export interface SpecDetails {
  trStatus?: string;
  trDate?: string;
  trUri?: string;
}

export interface GroupDetails {
  identifier: string;
  name: string;
  chairs: string[];
  teamContacts: string[];
  endDate?: string;
  homepage: string;
}

const opts = { ttlMs: DAY };
type Links<K extends string> = { _links?: Partial<Record<K, { title?: string; href?: string }[]>> };

export async function getSpecDetails(http: Http, shortname: string): Promise<SpecDetails | undefined> {
  const spec = await http.json<{ _links?: { 'latest-version'?: { href?: string } } }>(
    `${URLS.w3capi}specifications/${encodeURIComponent(shortname)}`,
    opts,
  );
  const href = spec?._links?.['latest-version']?.href;
  if (!href) return undefined;
  const v = await http.json<{ status?: string; date?: string; uri?: string }>(href, opts);
  return v ? { trStatus: v.status, trDate: v.date, trUri: v.uri } : undefined;
}

export async function getGroupDetails(http: Http, identifier: string): Promise<GroupDetails | undefined> {
  const base = `${URLS.w3capi}groups/${identifier}`;
  const group = await http.json<{ name?: string; 'end-date'?: string }>(base, opts);
  if (!group?.name) return undefined;
  const [chairs, contacts] = await Promise.all([
    http.json<Links<'chairs'>>(`${base}/chairs`, opts).catch(() => undefined),
    http.json<Links<'team-contacts'>>(`${base}/teamcontacts`, opts).catch(() => undefined),
  ]);
  const titles = (list?: { title?: string }[]) => (list ?? []).map((x) => x.title).filter((t): t is string => !!t);
  return {
    identifier,
    name: group.name,
    endDate: group['end-date'] ?? undefined,
    chairs: titles(chairs?._links?.chairs),
    teamContacts: titles(contacts?._links?.['team-contacts']),
    homepage: `https://www.w3.org/groups/${identifier}/`,
  };
}
