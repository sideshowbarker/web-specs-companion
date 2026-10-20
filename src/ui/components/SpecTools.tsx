import { useEffect, useState } from 'preact/hooks';
import { getSettings, setSettings, type Settings } from '../../shared/settings.ts';
import { LinkCheck } from './LinkCheck.tsx';
import { ReviewBlock } from './Review.tsx';

export function SpecTools({ tabId, shortname, url }: { tabId: number; shortname: string; url: string }) {
  const [settings, setLocal] = useState<Settings>({ usedBy: true, reviewButton: true });
  useEffect(() => {
    getSettings().then(setLocal, () => {});
  }, []);
  const toggle = (key: keyof Settings, label: string) => (
    <label class="toggle">
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(e) => {
          const v = (e.currentTarget as HTMLInputElement).checked;
          setLocal((s) => ({ ...s, [key]: v }));
          setSettings({ [key]: v }).catch(() => {});
        }}
      />{' '}
      {label}
    </label>
  );
  return (
    <section class="tools" aria-labelledby="tools-h">
      <h2 id="tools-h">On this page</h2>
      {toggle('usedBy', 'Show how many other specs use each definition')}
      {toggle('reviewButton', 'Show a Comment button beside text you select')}
      <LinkCheck tabId={tabId} />
      <ReviewBlock tabId={tabId} shortname={shortname} url={url} />
    </section>
  );
}
