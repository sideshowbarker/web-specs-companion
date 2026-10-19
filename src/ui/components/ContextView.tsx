import type { Context, TpacEvent } from '../../shared/types.ts';
import { RepoCard } from './RepoCard.tsx';
import { SpecCard } from './SpecCard.tsx';

export function ContextView({ ctx, tabId, slots }: { ctx: Context | null; tabId?: number; slots: Record<string, TpacEvent[]> }) {
  if (!ctx || ctx.kind === 'none' || tabId === undefined) {
    return (
      <p class="empty">
        {'Open a web spec, a W3C repository on GitHub, or a w3.org group page to see all that\u2019s known about it.'}
      </p>
    );
  }
  if (ctx.kind === 'spec') return <SpecCard ctx={ctx} tabId={tabId} slots={slots} />;
  return <RepoCard ctx={ctx} slots={slots} />;
}
