// Runs on spec pages at document_idle in the isolated world, as declared by the manifest's run_at and world keys:
// https://w3c.github.io/webextensions/specification/#key-run_at
import '../shared/browser.ts';
import { send } from '../shared/messages.ts';
import { getSettings, onSettingsChanged } from '../shared/settings.ts';
import { extractSpecFacts, whenSpecReady } from './extract.ts';
import { UsedByLayer } from './usedby.ts';

let layer: UsedByLayer | undefined;

async function showUsedBy(shortname: string) {
  const { map, specdex } = await send('get-used-by', { shortname });
  if (!map || layer) return;
  layer = new UsedByLayer(document, map, { specdex });
  await layer.render();
}

function hideUsedBy() {
  layer?.clear();
  layer = undefined;
}

async function main() {
  await whenSpecReady(document, window);
  const facts = extractSpecFacts(document, location.href);
  const { shortname } = await send('page-facts', { facts });
  if (!shortname) return;
  if ((await getSettings()).usedBy) await showUsedBy(shortname);
  onSettingsChanged((s) => {
    if (s.usedBy) showUsedBy(shortname).catch(() => {});
    else hideUsedBy();
  });
}

main().catch((err) => console.debug('w3c-companion:', err));
