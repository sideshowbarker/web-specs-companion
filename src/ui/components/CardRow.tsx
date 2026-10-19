import { useState } from 'preact/hooks';
import { send } from '../api.ts';
import { useAsync } from '../hooks.ts';
import { CaniuseButton, CaniusePanel } from './Caniuse.tsx';
import { Implementations, Why } from './Implementations.tsx';
import { MdnButton, MdnPanel } from './Mdn.tsx';
import { WptButton, WptPanel } from './Wpt.tsx';

type Panel = 'missing' | 'mdn' | 'caniuse' | 'wpt' | null;

// The row under the card's header: the browser logos on the left, and the MDN, Can I Use, and wpt.fyi buttons together
// at the right end, each shown once its answer arrives, with the panel each one opens below the row. Only one panel is
// open at a time, and when the row runs out of room, the buttons wrap onto a line of their own.
export function CardRow({ shortname }: { shortname: string }) {
  const impl = useAsync(() => send('get-implementations', { shortname }), [shortname]).value?.impl;
  const mdn = useAsync(() => send('get-mdn', { shortname }), [shortname]).value?.mdn;
  const caniuse = useAsync(() => send('get-caniuse', { shortname }), [shortname]).value?.caniuse;
  const wpt = useAsync(() => send('get-wpt', { shortname }), [shortname]).value?.wpt;
  const [open, setOpen] = useState<Panel>(null);
  if (!impl && !mdn && !caniuse && !wpt) return null;
  const toggle = (panel: Panel) => () => setOpen(open === panel ? null : panel);
  return (
    <>
      <div class="impl-row">
        {impl && <Implementations impl={impl} open={open === 'missing'} onToggle={toggle('missing')} />}
        {(mdn || caniuse || wpt) && (
          <div class="refs">
            {mdn && <MdnButton view={mdn} open={open === 'mdn'} onToggle={toggle('mdn')} />}
            {caniuse && <CaniuseButton answer={caniuse} open={open === 'caniuse'} onToggle={toggle('caniuse')} />}
            {wpt && <WptButton answer={wpt} open={open === 'wpt'} onToggle={toggle('wpt')} />}
          </div>
        )}
      </div>
      {impl && <Why impl={impl} hidden={open !== 'missing'} />}
      {mdn && <MdnPanel view={mdn} open={open === 'mdn'} />}
      {caniuse && <CaniusePanel answer={caniuse} open={open === 'caniuse'} />}
      {wpt && <WptPanel answer={wpt} open={open === 'wpt'} />}
    </>
  );
}
