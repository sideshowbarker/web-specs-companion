import { type SpecIndex, specRef } from '../data/specs.ts';
import type { Dfn } from '../data/webref.ts';
import type { OutLink } from '../content/links.ts';
import type { SpecRef } from '../shared/types.ts';
import { fragmentOf } from '../shared/url.ts';

export interface TargetData {
  fragments: Map<string, string>; // decoded fragment -> absolute URL
  dfns: Dfn[];
}

export interface LinkProblem {
  i: number;
  href: string;
  text: string;
  target: SpecRef;
  suggestion?: string;
}

export interface LinkCheckResult {
  problems: LinkProblem[];
  checked: number;
  skipped: number;
  targets: number;
  crawlDate?: string;
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export function suggestAnchor(text: string, fragment: string, target: TargetData): string | undefined {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (t) {
    const byText = target.dfns.filter((d) => d.linkingText.some((l) => l.toLowerCase() === t));
    const pick = byText.find((d) => d.access === 'public') ?? byText[0];
    if (pick) return pick.href;
  }
  const max = Math.max(2, Math.floor(fragment.length * 0.3));
  let best: { url: string; d: number } | undefined;
  for (const [frag, url] of target.fragments) {
    if (frag.slice(0, 3) !== fragment.slice(0, 3)) continue;
    const d = levenshtein(frag, fragment, max);
    if (d <= max && (!best || d < best.d)) best = { url, d };
  }
  return best?.url;
}

export async function checkLinks(
  links: OutLink[],
  self: string,
  specs: SpecIndex,
  loadTarget: (shortname: string) => Promise<TargetData | undefined>,
): Promise<LinkCheckResult> {
  const groups = new Map<string, { link: OutLink; fragment: string }[]>();
  let skipped = 0;
  for (const link of links) {
    const m = specs.lookup(link.href);
    const fragment = fragmentOf(link.href);
    if (!m || m.spec.shortname === self || !fragment) {
      skipped++;
      continue;
    }
    groups.set(m.spec.shortname, [...(groups.get(m.spec.shortname) ?? []), { link, fragment }]);
  }

  const problems: LinkProblem[] = [];
  let checked = 0;
  let targets = 0;
  const queue = [...groups.entries()];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [shortname, items] = next;
      const data = await loadTarget(shortname).catch(() => undefined);
      if (!data) {
        skipped += items.length;
        continue;
      }
      targets++;
      const target = specRef(specs.get(shortname)!);
      for (const { link, fragment } of items) {
        checked++;
        if (data.fragments.has(fragment)) continue;
        problems.push({ i: link.i, href: link.href, text: link.text, target, suggestion: suggestAnchor(link.text, fragment, data) });
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  problems.sort((a, b) => a.i - b.i);
  return { problems, checked, skipped, targets };
}
