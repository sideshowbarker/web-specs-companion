export const URLS = {
  specs: 'https://w3c.github.io/browser-specs/index.json',
  groups: 'https://w3c.github.io/groups/w3c-groups.json',
  repos: 'https://w3c.github.io/groups/repositories.json',
  idlnames: 'https://w3c.github.io/webref/ed/idlnames.json',
  implementations: 'https://w3c-oss.github.io/w3c-companion/data/implementations.json',
  tpac: 'https://www.w3.org/calendar/tpac2026/export/',
  webref: 'https://w3c.github.io/webref/ed/',
  w3capi: 'https://api.w3.org/',
  xref: 'https://respec.org/xref/search/',
} as const;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
