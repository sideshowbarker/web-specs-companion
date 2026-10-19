import { send } from '../api.ts';
import { relativeAge } from '../format.ts';
import { useAsync } from '../hooks.ts';

const LABELS: Record<string, string> = { specs: 'Specs', groups: 'Groups', repos: 'Repositories', implementations: 'Browser support', mdn: 'MDN articles', caniuse: 'Can I Use', tpac: 'TPAC schedule' };

export function Freshness({ now = Date.now() }: { now?: number }) {
  const r = useAsync(() => send('get-freshness', {}), []);
  const sources = r.value?.sources ?? [];
  if (sources.length === 0) return null;
  const offline = sources.some((s) => s.origin === 'bundled' || s.origin === 'stale');
  return (
    <div class="freshness muted">
      {offline && <p class="warn">{'Some live data couldn\u2019t be fetched, so this uses the last copy the extension has.'}</p>}
      <p>
        Data updated:{' '}
        {sources.map((s, i) => (
          <span key={s.name}>{i > 0 && ' · '}{LABELS[s.name] ?? s.name} {relativeAge(s.fetchedAt, now)}</span>
        ))}
      </p>
    </div>
  );
}
