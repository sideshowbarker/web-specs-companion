// Runs on spec pages at document_idle in the isolated world, as declared by the manifest's run_at and world keys:
// https://w3c.github.io/webextensions/specification/#key-run_at
import '../shared/browser.ts';
import { send } from '../shared/messages.ts';
import { extractSpecFacts, whenSpecReady } from './extract.ts';

async function main() {
  await whenSpecReady(document, window);
  const facts = extractSpecFacts(document, location.href);
  const reply = await send('page-facts', { facts });
  return reply.shortname;
}

main().catch((err) => console.debug('w3c-companion:', err));
