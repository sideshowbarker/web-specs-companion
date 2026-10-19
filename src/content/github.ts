// Injected only on github.com pages whose owner hosts W3C repos, per the manifest's generated include_globs:
// https://w3c.github.io/webextensions/specification/#key-include_globs
import '../shared/browser.ts';
import { send } from '../shared/messages.ts';
import { readGitHubFacts, watchNavigation } from './github-facts.ts';

const report = (url: string) =>
  send('page-facts', { facts: readGitHubFacts(document, url) }).catch((err) => console.debug('web-specs-companion:', err));

report(location.href);
watchNavigation(window, document, report);
