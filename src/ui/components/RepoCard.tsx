import type { Context, TpacEvent } from '../../shared/types.ts';
import { A } from './A.tsx';
import { GroupBlock } from './GroupBlock.tsx';

export function RepoCard({ ctx, slots }: { ctx: Context; slots: Record<string, TpacEvent[]> }) {
  const repo = ctx.repo;
  const heading = repo ? repo.nwo : ctx.groups[0]?.name ?? 'W3C group';
  return (
    <section class="card" aria-labelledby="card-title">
      <header class="card-head">
        <h1 id="card-title">{repo ? <A href={repo.url}>{heading}</A> : heading}</h1>
        {repo?.number && <p class="muted">{ctx.kind === 'pr' ? 'PR' : 'Issue'} #{repo.number}</p>}
      </header>
      {repo && ctx.groups.length === 0 && <p class="muted">No W3C group is recorded for this repository.</p>}
      {ctx.groups.map((g) => <GroupBlock key={g.identifier} group={g} slots={slots[g.name]} />)}
      {ctx.repoSpecs && ctx.repoSpecs.length > 0 && (
        <div class="specs">
          <h2>{repo ? 'Specs in this repository' : 'Specs from this group'}</h2>
          <ul>
            {ctx.repoSpecs.map((s) => (
              <li key={s.shortname}>
                <A href={s.nightly?.url ?? s.url}>{s.title}</A>
                {s.release && <> · <A href={s.release.url}>TR</A></>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
