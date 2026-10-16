import { webidlpediaUrl } from '../../logic/search.ts';
import type { SpecRef } from '../../shared/types.ts';
import { send } from '../api.ts';
import { useAsync } from '../hooks.ts';
import { A } from './A.tsx';

function SpecList({ summary, specs }: { summary: string; specs: SpecRef[] }) {
  return (
    <li>
      <details>
        <summary>{summary}</summary>
        <ul>{specs.map((s) => <li key={s.shortname}><A href={s.url}>{s.title}</A></li>)}</ul>
      </details>
    </li>
  );
}

export function Footprint({ shortname }: { shortname: string }) {
  const r = useAsync(() => send('get-footprint', { shortname }), [shortname]);
  const f = r.value?.footprint;
  if (!f) return null;
  return (
    <section class="footprint" aria-labelledby="footprint-h">
      <h2 id="footprint-h">Platform footprint</h2>
      <ul>
        <SpecList summary={`Referenced by ${f.referencedBy.length} other specs`} specs={f.referencedBy} />
        <SpecList summary={`Uses terms from ${f.usesTermsFrom.length} specs`} specs={f.usesTermsFrom} />
        <li>
          <details>
            <summary>{f.normativeRefs.length} normative references</summary>
            <ul>{f.normativeRefs.map((r) => <li key={r.url}><A href={r.url}>{r.name}</A></li>)}</ul>
          </details>
        </li>
        {f.extendsInterfaces.length > 0 && (
          <li>
            <details>
              <summary>Adds to {f.extendsInterfaces.length} interfaces defined elsewhere</summary>
              <ul>{f.extendsInterfaces.map((n) => <li key={n}><A href={webidlpediaUrl(n)}>{n}</A></li>)}</ul>
            </details>
          </li>
        )}
      </ul>
      <p class="muted">
        From webref{f.crawlDate ? `, crawled ${f.crawlDate}` : ''}. <A href={f.specdex}>Every definition on specdex</A>
      </p>
    </section>
  );
}
