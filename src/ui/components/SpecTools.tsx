import { useEffect, useState } from 'preact/hooks';
import { getSettings, setSettings } from '../../shared/settings.ts';
import { LinkCheck } from './LinkCheck.tsx';

export function SpecTools({ tabId }: { tabId: number }) {
  const [usedBy, setUsedBy] = useState(true);
  useEffect(() => {
    getSettings().then((s) => setUsedBy(s.usedBy), () => {});
  }, []);
  return (
    <section class="tools" aria-labelledby="tools-h">
      <h2 id="tools-h">On this page</h2>
      <label class="toggle">
        <input
          type="checkbox"
          checked={usedBy}
          onChange={(e) => {
            const v = (e.currentTarget as HTMLInputElement).checked;
            setUsedBy(v);
            setSettings({ usedBy: v }).catch(() => {});
          }}
        />{' '}
        Show how many other specs use each definition
      </label>
      <LinkCheck tabId={tabId} />
    </section>
  );
}
