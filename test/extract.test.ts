// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { detectGenerator, extractSpecFacts, isRespecPending, whenSpecReady } from '../src/content/extract.ts';
import { RESPEC_READY } from '../src/shared/messages.ts';

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const BIKESHED = `<!doctype html><html><head>
<meta content="Bikeshed version 5.3.0" name="generator">
<meta content="ED" name="w3c-status">
<meta content="388c204d54306eba416e850358bd8db2fa484a0d" name="revision">
</head><body class="h-entry"><div class="head">
<h1 class="p-name" id="title">Fetch Metadata Request Headers</h1>
<p id="w3c-state"><a href="https://www.w3.org/standards/types/#ED">Editor\u2019s Draft</a>, <time class="dt-updated" datetime="2026-10-01">1 October 2026</time></p>
<details open><summary>More details about this document</summary><div data-fill-with="spec-metadata"><dl>
<dt>This version:<dd><a class="u-url" href="https://w3c.github.io/webappsec-fetch-metadata/">https://w3c.github.io/webappsec-fetch-metadata/</a>
<dt>Latest published version:<dd><a href="https://www.w3.org/TR/fetch-metadata/">https://www.w3.org/TR/fetch-metadata/</a>
<dt>History:<dd><a href="https://www.w3.org/standards/history/fetch-metadata/">https://www.w3.org/standards/history/fetch-metadata/</a>
<dt>Feedback:<dd><span><a href="https://github.com/w3c/webappsec-fetch-metadata/issues/">GitHub</a></span>
</dl></div></details></div>
<section id="sotd"><p>Published by the <a href="https://www.w3.org/groups/wg/webappsec">Web Application Security Working Group</a>.
<a href="https://www.w3.org/groups/wg/webappsec/ipr">patent disclosures</a></p></section>
<p><dfn data-dfn-type="dfn" data-export id="sec-fetch-dest-header">Sec-Fetch-Dest</dfn></p>
</body></html>`;

const RESPEC_RENDERED = `<!doctype html><html><head>
<meta name="generator" content="ReSpec 35.4.0">
<script id="initialUserConfig" type="application/json">{"specStatus":"ED","shortName":"wai-aria-1.3","github":"w3c/aria","group":"aria"}</script>
</head><body><div class="head">
<h1 id="title">Accessible Rich Internet Applications (WAI-ARIA) 1.3</h1>
<p id="w3c-state">W3C Editor's Draft <time class="dt-published" datetime="2026-10-12">12 October 2026</time></p>
<details open><dl>
<dt>This version:</dt><dd><a class="u-url" href="https://w3c.github.io/aria/">https://w3c.github.io/aria/</a></dd>
<dt>Latest published version:</dt><dd><a href="https://www.w3.org/TR/wai-aria-1.3/">https://www.w3.org/TR/wai-aria-1.3/</a></dd>
<dt>Feedback:</dt><dd><a href="https://github.com/w3c/aria/">GitHub w3c/aria</a> (<a href="https://github.com/w3c/aria/pulls/">pull requests</a>, <a href="https://github.com/w3c/aria/issues/new/choose">new issue</a>, <a href="https://github.com/w3c/aria/issues/">open issues</a>)</dd>
</dl></details></div>
<section id="sotd"><p>Published by the <a href="https://www.w3.org/groups/wg/aria">ARIA Working Group</a></p></section>
</body></html>`;

const RESPEC_PENDING = `<!doctype html><html><head>
<script src="https://www.w3.org/Tools/respec/respec-w3c" class="remove" defer></script>
<script class="remove">var respecConfig = { specStatus: "ED", shortName: "wai-aria-1.3" };</script>
</head><body><section id="abstract"><p>Abstract</p></section></body></html>`;

describe('detectGenerator', () => {
  it('recognizes Bikeshed, ReSpec (rendered and pending), and the HTML Standard', () => {
    expect(detectGenerator(docFrom(BIKESHED), 'https://w3c.github.io/webappsec-fetch-metadata/')).toBe('bikeshed');
    expect(detectGenerator(docFrom(RESPEC_RENDERED), 'https://w3c.github.io/aria/')).toBe('respec');
    expect(detectGenerator(docFrom(RESPEC_PENDING), 'https://w3c.github.io/aria/')).toBe('respec');
    expect(detectGenerator(docFrom('<html><head></head><body></body></html>'), 'https://html.spec.whatwg.org/multipage/parsing.html')).toBe('wattsi');
    expect(detectGenerator(docFrom('<html><body><p>hi</p></body></html>'), 'https://w3c.github.io/groups/')).toBe('unknown');
  });
});

describe('isRespecPending', () => {
  it('is true only before ReSpec has rendered', () => {
    expect(isRespecPending(docFrom(RESPEC_PENDING))).toBe(true);
    expect(isRespecPending(docFrom(RESPEC_RENDERED))).toBe(false);
    expect(isRespecPending(docFrom(BIKESHED))).toBe(false);
  });
});

describe('extractSpecFacts', () => {
  it('reads a Bikeshed header by link targets', () => {
    const f = extractSpecFacts(docFrom(BIKESHED), 'https://w3c.github.io/webappsec-fetch-metadata/');
    expect(f).toMatchObject({
      kind: 'spec',
      generator: 'bikeshed',
      title: 'Fetch Metadata Request Headers',
      status: 'ED',
      edUrl: 'https://w3c.github.io/webappsec-fetch-metadata/',
      latestUrl: 'https://www.w3.org/TR/fetch-metadata/',
      historyUrl: 'https://www.w3.org/standards/history/fetch-metadata/',
      issuesUrl: 'https://github.com/w3c/webappsec-fetch-metadata/issues/',
      repoUrl: 'https://github.com/w3c/webappsec-fetch-metadata',
      groupUrls: ['https://www.w3.org/groups/wg/webappsec/'],
      date: '2026-10-01',
      revision: '388c204d54306eba416e850358bd8db2fa484a0d',
      outdatedBanner: false,
    });
  });

  it('reads a rendered ReSpec draft, including its config', () => {
    const f = extractSpecFacts(docFrom(RESPEC_RENDERED), 'https://w3c.github.io/aria/');
    expect(f).toMatchObject({
      generator: 'respec',
      shortname: 'wai-aria-1.3',
      status: 'ED',
      latestUrl: 'https://www.w3.org/TR/wai-aria-1.3/',
      issuesUrl: 'https://github.com/w3c/aria/issues/',
      repoUrl: 'https://github.com/w3c/aria',
      groupUrls: ['https://www.w3.org/groups/wg/aria/'],
      date: '2026-10-12',
    });
  });

  it("notices W3C's own outdated-version banner", () => {
    const d = docFrom(BIKESHED);
    d.body.classList.add('outdated-spec');
    expect(extractSpecFacts(d, 'https://www.w3.org/TR/2020/WD-x-20200101/').outdatedBanner).toBe(true);
  });
});

describe('whenSpecReady', () => {
  it("resolves at once for a page that isn't a pending ReSpec draft", async () => {
    await expect(whenSpecReady(docFrom(BIKESHED), window, 50)).resolves.toBeUndefined();
  });

  // Parsed documents never run their scripts, so these tests don't try to load ReSpec from the network.
  it("waits for the MAIN-world probe's message on a pending ReSpec draft", async () => {
    let done = false;
    const p = whenSpecReady(docFrom(RESPEC_PENDING), window, 5_000).then(() => { done = true; });
    await new Promise((r) => setTimeout(r, 20));
    expect(done).toBe(false);
    window.postMessage(RESPEC_READY, '*');
    await p;
    expect(done).toBe(true);
  });

  it("stops waiting once ReSpec's rendered config appears", async () => {
    const doc = docFrom(RESPEC_PENDING);
    const p = whenSpecReady(doc, window, 5_000);
    const cfg = doc.createElement('script');
    cfg.id = 'initialUserConfig';
    doc.head.append(cfg);
    await expect(p).resolves.toBeUndefined();
  });

  it('gives up waiting after the timeout', async () => {
    await expect(whenSpecReady(docFrom(RESPEC_PENDING), window, 30)).resolves.toBeUndefined();
  });
});
