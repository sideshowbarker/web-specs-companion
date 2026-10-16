import { badgeColor, maturityFor } from '../../logic/maturity.ts';
import type { Context, TpacEvent } from '../../shared/types.ts';
import { specLinks } from '../format.ts';
import { A } from './A.tsx';
import { Footprint } from './Footprint.tsx';
import { GroupBlock } from './GroupBlock.tsx';
import { Radar } from './Radar.tsx';
import { SpecTools } from './SpecTools.tsx';

export function SpecCard({ ctx, tabId, slots }: { ctx: Context; tabId: number; slots: Record<string, TpacEvent[]> }) {
  const code = maturityFor(ctx);
  const title = ctx.spec?.title ?? ctx.facts?.title ?? 'Untitled specification';
  return (
    <section class="card" aria-labelledby="card-title">
      <header class="card-head">
        {code && <span class="chip" style={{ background: badgeColor(code) }}>{code}</span>}
        <h1 id="card-title"><A href={ctx.spec?.url ?? ctx.url}>{title}</A></h1>
        {ctx.spec && <p class="muted">{ctx.spec.shortname}</p>}
      </header>
      <Radar tabId={tabId} url={ctx.url} />
      {ctx.otherLevels && ctx.otherLevels.length > 0 && (
        <p class="note">The same draft also serves {ctx.otherLevels.map((s) => s.title).join(', ')}.</p>
      )}
      <ul class="links">
        {specLinks(ctx).map((l) => <li key={l.label}><A href={l.href}>{l.label}</A></li>)}
      </ul>
      {ctx.groups.map((g) => <GroupBlock key={g.identifier} group={g} slots={slots[g.name]} />)}
      {ctx.spec && <Footprint shortname={ctx.spec.shortname} />}
      {ctx.spec && ctx.facts?.kind === 'spec' && <SpecTools tabId={tabId} />}
    </section>
  );
}
