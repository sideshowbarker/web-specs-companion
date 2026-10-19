import { useState } from 'preact/hooks';
import { send } from '../api.ts';
import { useAsync } from '../hooks.ts';
import { CaniuseButton, CaniusePanel } from './Caniuse.tsx';
import { Implementations, Why } from './Implementations.tsx';
import { MdnButton, MdnPanel } from './Mdn.tsx';

type Panel = 'missing' | 'mdn' | 'caniuse' | null;

// The row under the card's header: the browser logos on the left, and the MDN and Can I Use buttons together at the
// right end, each shown once its answer arrives, with the panel each one opens below the row. Only one panel is open at
// a time, and when the row runs out of room, the buttons wrap onto a line of their own.
export function CardRow({ shortname }: { shortname: string }) {
  const impl = useAsync(() => send('get-implementations', { shortname }), [shortname]).value?.impl;
  const mdn = useAsync(() => send('get-mdn', { shortname }), [shortname]).value?.mdn;
  const caniuse = useAsync(() => send('get-caniuse', { shortname }), [shortname]).value?.caniuse;
  const [open, setOpen] = useState<Panel>(null);
  if (!impl && !mdn && !caniuse) return null;
  const toggle = (panel: Panel) => () => setOpen(open === panel ? null : panel);
  return (
    <>
      <div class="impl-row">
        {impl && <Implementations impl={impl} open={open === 'missing'} onToggle={toggle('missing')} />}
        {(mdn || caniuse) && (
          <div class="refs">
            {mdn && <MdnButton view={mdn} open={open === 'mdn'} onToggle={toggle('mdn')} />}
            {caniuse && <CaniuseButton answer={caniuse} open={open === 'caniuse'} onToggle={toggle('caniuse')} />}
          </div>
        )}
      </div>
      {impl && <Why impl={impl} hidden={open !== 'missing'} />}
      {mdn && <MdnPanel view={mdn} open={open === 'mdn'} />}
      {caniuse && <CaniusePanel answer={caniuse} open={open === 'caniuse'} />}
    </>
  );
}
