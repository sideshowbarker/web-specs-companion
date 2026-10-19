import type { RadarNote } from '../../logic/radar.ts';
import { send } from '../api.ts';
import { useAsync } from '../hooks.ts';
import { A } from './A.tsx';

function Note({ n }: { n: RadarNote }) {
  switch (n.kind) {
    case 'latest-tr':
      return <>A newer TR version exists: <A href={n.url}>the latest TR</A>.</>;
    case 'newer-level':
      return <>A newer level exists: <A href={n.spec.url}>{n.spec.title}</A>.</>;
    case 'obsolete':
      return <>Obsoleted by {n.by.map((s, i) => <>{i > 0 && ', '}<A href={s.url}>{s.title}</A></>)}.</>;
    case 'delta':
      return <>This level lists only its changes; read it together with <A href={n.base.url}>{n.base.title}</A>.</>;
    case 'tr-lag':
      return <>The latest TR ({n.trDate}) is {n.months} months behind this draft.</>;
    case 'behind-ed':
      return <>This TR is {n.months} months behind the <A href={n.edUrl}>{'Editor\u2019s Draft'}</A> ({n.edDate}).</>;
  }
}

export function Radar({ tabId, url }: { tabId: number; url: string }) {
  const r = useAsync(() => send('get-radar', { tabId, url }), [tabId, url]);
  const radar = r.value?.radar;
  if (!radar) return null;
  return (
    <div class="radar">
      <p class="radar-label">{radar.label}</p>
      {radar.notes.length > 0 && (
        <ul>
          {radar.notes.map((n) => (
            <li key={n.kind}><Note n={n} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
