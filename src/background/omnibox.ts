import type { SearchItem } from '../logic/search.ts';

export const SITE_SEARCH = 'https://www.w3.org/Search/?q=';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Some engines render omnibox descriptions as markup, and require escaping; others show them as plain text.
export function suggestionFor(item: SearchItem, markup: boolean) {
  const description = markup
    ? `<match>${escapeXml(item.label)}</match> <dim>${escapeXml(item.detail)}</dim>`
    : `${item.label} — ${item.detail}`;
  return { content: item.url, description };
}

export async function omniboxTarget(
  text: string,
  find: (q: string) => Promise<SearchItem[]>,
  resolveIdl: (name: string) => Promise<string>,
): Promise<string> {
  const t = text.trim();
  if (/^https:\/\//.test(t)) return t;
  const [best] = await find(t);
  if (best?.kind === 'idl' && best.idlName) return resolveIdl(best.idlName);
  if (best) return best.url;
  return `${SITE_SEARCH}${encodeURIComponent(t)}`;
}
