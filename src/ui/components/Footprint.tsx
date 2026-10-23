import { mostUsed, webrefBehind } from '../../logic/footprint.ts';
import { webidlpediaUrl } from '../../logic/search.ts';
import type { PageKind, SpecRef } from '../../shared/types.ts';
import { send } from '../api.ts';
import { formatDate } from '../format.ts';
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

export function Footprint({ shortname, pageKind, pageRevision }: { shortname: string; pageKind?: PageKind; pageRevision?: string }) {
  const r = useAsync(() => send('get-footprint', { shortname }), [shortname]);
  const u = useAsync(() => send('get-used-by', { shortname }), [shortname]);
  const f = r.value?.footprint;
  if (!f) return null;
  const top = u.value?.map ? mostUsed(u.value.map) : [];
  return (
    <section class="footprint" aria-labelledby="footprint-h">
      <h2 id="footprint-h">Platform footprint</h2>
      {(pageKind === 'tr' || pageKind === 'dated-tr') && (
        <p class="note">{'This data comes from the editor\u2019s draft, which can differ from this TR version.'}</p>
      )}
      {webrefBehind(pageRevision, f.revision) && (
        <p class="note">Webref crawled a different revision of this draft{f.crawlDate ? ` (on ${formatDate(f.crawlDate)})` : ''}, so recent changes may be missing.</p>
      )}
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
      {top.length > 0 && (
        <>
          <h3>Most-used definitions</h3>
          <ul class="most-used">
            {top.map((d) => (
              <li key={d.id}>
                <A href={d.href}>{d.term}</A> <span class="muted">used by {d.count} other spec{d.count === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p class="muted">
        From webref{f.crawlDate ? `, crawled ${formatDate(f.crawlDate)}` : ''}. <A href={f.specdex}>Every definition on specdex</A>
      </p>
    </section>
  );
}
