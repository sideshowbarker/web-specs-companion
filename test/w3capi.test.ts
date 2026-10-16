import { describe, it, expect, vi } from 'vitest';
import { createHttp, MemoryStore } from '../src/data/http.ts';
import { getGroupDetails, getSpecDetails } from '../src/data/w3capi.ts';

function routes(map: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return url in map ? new Response(JSON.stringify(map[url])) : new Response('', { status: 404 });
  });
}

describe('getSpecDetails', () => {
  it('follows latest-version to the TR status and date', async () => {
    const http = createHttp(new MemoryStore(), routes({
      'https://api.w3.org/specifications/fetch-metadata': { _links: { 'latest-version': { href: 'https://api.w3.org/specifications/fetch-metadata/versions/20260921' } } },
      'https://api.w3.org/specifications/fetch-metadata/versions/20260921': { status: 'Working Draft', date: '2026-09-21', uri: 'https://www.w3.org/TR/2026/WD-fetch-metadata-20260921/' },
    }), () => 0);
    expect(await getSpecDetails(http, 'fetch-metadata')).toEqual({
      trStatus: 'Working Draft', trDate: '2026-09-21', trUri: 'https://www.w3.org/TR/2026/WD-fetch-metadata-20260921/',
    });
  });

  it("returns undefined for a spec the API doesn't know", async () => {
    const http = createHttp(new MemoryStore(), routes({}), () => 0);
    expect(await getSpecDetails(http, 'nope')).toBeUndefined();
  });
});

describe('getGroupDetails', () => {
  it('collects chairs, team contacts, and the charter end date', async () => {
    const http = createHttp(new MemoryStore(), routes({
      'https://api.w3.org/groups/wg/webappsec': { name: 'Web Application Security Working Group', 'end-date': '2026-10-30' },
      'https://api.w3.org/groups/wg/webappsec/chairs': { _links: { chairs: [{ title: 'Daniel Veditz' }, { title: 'Mike West' }] } },
      'https://api.w3.org/groups/wg/webappsec/teamcontacts': { _links: { 'team-contacts': [{ title: 'Simone Onofri' }] } },
    }), () => 0);
    expect(await getGroupDetails(http, 'wg/webappsec')).toEqual({
      identifier: 'wg/webappsec',
      name: 'Web Application Security Working Group',
      endDate: '2026-10-30',
      chairs: ['Daniel Veditz', 'Mike West'],
      teamContacts: ['Simone Onofri'],
      homepage: 'https://www.w3.org/groups/wg/webappsec/',
    });
  });

  it('still returns the group when its chair list fails to load', async () => {
    const http = createHttp(new MemoryStore(), routes({
      'https://api.w3.org/groups/cg/wicg': { name: 'Web Platform Incubator Community Group' },
    }), () => 0);
    expect(await getGroupDetails(http, 'cg/wicg')).toMatchObject({ name: 'Web Platform Incubator Community Group', chairs: [], teamContacts: [] });
  });
});
