import { useState } from 'preact/hooks';
import type { TpacView } from '../../data/tpac.ts';
import { DAY } from '../../data/urls.ts';
import type { TpacEvent } from '../../shared/types.ts';
import { formatTpacTime } from '../format.ts';
import { A } from './A.tsx';

type Filter = 'all' | 'group' | 'breakout';

function Events({ title, events }: { title: string; events: TpacEvent[] }) {
  return (
    <>
      <h3>{title}</h3>
      {events.length === 0 ? (
        <p class="muted">Nothing scheduled.</p>
      ) : (
        <ul class="events">
          {events.map((e) => (
            <li key={e.uid}>
              {e.url ? <A href={e.url}>{e.title}</A> : e.title}
              <span class="muted"> {formatTpacTime(e.start)}{e.room ? `, ${e.room}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Tpac({ view, now = Date.now() }: { view?: TpacView; now?: number }) {
  const [filter, setFilter] = useState<Filter>('all');
  if (!view?.visible) return null;
  const keep = (e: TpacEvent) => filter === 'all' || e.kind === filter;
  const before = view.firstStart !== undefined && now < view.firstStart && view.now.length === 0;
  return (
    <section class="tpac" aria-labelledby="tpac-h">
      <h2 id="tpac-h">TPAC 2026, Dublin</h2>
      {before ? (
        <p>
          TPAC starts Monday 26 October, in {Math.ceil((view.firstStart! - now) / DAY)} days. All times are Dublin time (GMT).
        </p>
      ) : (
        <>
          <fieldset class="filter">
            <legend>Show</legend>
            {(['all', 'group', 'breakout'] as Filter[]).map((f) => (
              <label key={f}>
                <input type="radio" name="tpac-filter" checked={filter === f} onChange={() => setFilter(f)} />
                {f === 'all' ? 'Everything' : f === 'group' ? 'Group meetings' : 'Breakouts'}
              </label>
            ))}
          </fieldset>
          <Events title="Now" events={view.now.filter(keep)} />
          <Events title="Next two hours" events={view.next.filter(keep)} />
        </>
      )}
    </section>
  );
}
