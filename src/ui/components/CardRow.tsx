import { useState } from 'preact/hooks';
import { send } from '../api.ts';
import { useAsync } from '../hooks.ts';
import { Implementations, Why } from './Implementations.tsx';
import { MdnButton, MdnPanel } from './Mdn.tsx';

type Panel = 'missing' | 'mdn' | null;

// The row under the card's header: the browser logos on the left, and the MDN button at the right end, each shown once
// its answer arrives, with the panel each one opens below the row. Only one panel is open at a time.
export function CardRow({ shortname }: { shortname: string }) {
  const impl = useAsync(() => send('get-implementations', { shortname }), [shortname]).value?.impl;
  const mdn = useAsync(() => send('get-mdn', { shortname }), [shortname]).value?.mdn;
  const [open, setOpen] = useState<Panel>(null);
  if (!impl && !mdn) return null;
  const toggle = (panel: Panel) => () => setOpen(open === panel ? null : panel);
  return (
    <>
      <div class="impl-row">
        {impl && <Implementations impl={impl} open={open === 'missing'} onToggle={toggle('missing')} />}
        {mdn && <MdnButton view={mdn} open={open === 'mdn'} onToggle={toggle('mdn')} />}
      </div>
      {impl && <Why impl={impl} hidden={open !== 'missing'} />}
      {mdn && <MdnPanel view={mdn} open={open === 'mdn'} />}
    </>
  );
}
