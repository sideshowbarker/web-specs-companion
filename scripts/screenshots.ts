// Renders the screenshots in screenshots/ from the built extension: loads dist/ into a fresh Chrome profile over the
// DevTools protocol (Extensions.loadUnpacked, which needs --enable-unsafe-extension-debugging and a pipe connection),
// opens the real popup with action.openPopup() and the real side panel with a click in the popup, captures each surface
// in light mode at 2x, then composites them at 1280x800 (the size both stores take) with ImageMagick, and compresses
// them with pngquant. Browser UI such as the toolbar and the address-bar suggestions isn't page content, so it can't be
// captured this way. Set CHROME to use a Chrome other than the default macOS install.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { URLS } from '../src/data/urls.ts';

const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// The TPAC section's Now and Next lists fill only while the meetings run, so the TPAC shot runs the extension on a
// clock that starts on breakout day, Wednesday 28 October 2026, at 11:15 Dublin time (GMT).
const TPAC_MOMENT = Date.UTC(2026, 9, 28, 11, 15);

const work = await mkdtemp(join(tmpdir(), 'wsc-shots-'));
const raw = join(work, 'raw');
await mkdir(raw);
await mkdir('screenshots', { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const magick = (...args: string[]) => execFileSync('magick', args, { stdio: 'inherit' });

// Replaces Date in a page or worker before its own scripts run, so that it reads `start` at the moment it's installed
// and moves on in real time from there.
const clockScript = (start: number) => `(() => {
  const RealDate = Date;
  const offset = ${start} - RealDate.now();
  class ShiftedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset])); }
    static now() { return RealDate.now() + offset; }
  }
  globalThis.Date = ShiftedDate;
})();`;

// The website that serves the browser-support, MDN, Can I Use, and test-results files may not be up yet, so the
// background gets the build's own copies of those files instead: A fetch of any URL under the site's data/ reads the
// file of the same name from the extension, and every other fetch goes through unchanged.
const SITE_DATA = new URL('.', URLS.wpt).href;
const dataScript = `(() => {
  const site = ${JSON.stringify(SITE_DATA)};
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    return realFetch(url.startsWith(site) ? chrome.runtime.getURL('data/' + url.slice(site.length)) : input, init);
  };
})();`;

type Target = { targetId: string; type: string; url: string };

// Starts Chrome with the extension loaded and a tab at 1280x800, optionally with the extension on a shifted clock.
// Auto-attach pauses each new worker before it runs anything, so the background's data script and clock go in first;
// the popup and the side panel get their clock as a script for each new document, and then a reload.
async function launch(profile: string, clock?: number) {
  const chrome = spawn(chromePath, [
    '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', `--user-data-dir=${join(work, profile)}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1400,1000', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const toChrome = chrome.stdio[3] as Writable;
  const fromChrome = chrome.stdio[4] as Readable;

  let nextId = 0;
  let buffered = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cmd = (method: string, params: object = {}, sessionId?: string) =>
    new Promise<any>((ok, fail) => {
      const id = ++nextId;
      pending.set(id, { ok, fail });
      toChrome.write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  const onAttached = async ({ sessionId, targetInfo, waitingForDebugger }: {
    sessionId: string; targetInfo: Target; waitingForDebugger: boolean;
  }) => {
    if (targetInfo.type === 'service_worker') {
      await cmd('Runtime.evaluate', { expression: dataScript }, sessionId);
      if (clock !== undefined) await cmd('Runtime.evaluate', { expression: clockScript(clock) }, sessionId);
    }
    if (waitingForDebugger) await cmd('Runtime.runIfWaitingForDebugger', {}, sessionId);
  };
  fromChrome.on('data', (chunk: Buffer) => {
    buffered += chunk.toString();
    for (let end; (end = buffered.indexOf('\0')) >= 0; buffered = buffered.slice(end + 1)) {
      const msg = JSON.parse(buffered.slice(0, end));
      if (msg.method === 'Target.attachedToTarget') {
        onAttached(msg.params).catch((e) => console.error('attach:', e.message));
        continue;
      }
      const p = pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      if (msg.error) p.fail(new Error(`${msg.error.message}`));
      else p.ok(msg.result);
    }
  });
  await cmd('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

  const targets = async (): Promise<Target[]> => (await cmd('Target.getTargets')).targetInfos;
  const attach = async (targetId: string): Promise<string> =>
    (await cmd('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  const evaluate = async (session: string, expression: string) =>
    (await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session)).result.value;
  const light = (session: string) =>
    cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, session);
  const viewport = (session: string, width: number) =>
    cmd('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 2, mobile: false }, session);
  const waitFor = async (session: string, expression: string, ms = 30_000) => {
    for (let waited = 0; waited < ms; waited += 250) {
      if (await evaluate(session, expression).catch(() => false)) return;
      await sleep(250);
    }
    throw new Error(`timed out waiting for ${expression}`);
  };
  const findTarget = async (match: (t: Target) => boolean) => {
    for (let i = 0; i < 40; i++) {
      const t = (await targets()).find(match);
      if (t) return t;
      await sleep(250);
    }
    throw new Error('target never appeared');
  };
  const capture = async (session: string, name: string) => {
    const { data } = await cmd('Page.captureScreenshot', { format: 'png' }, session);
    await writeFile(join(raw, `${name}.png`), Buffer.from(data, 'base64'));
  };
  const close = async () => {
    // Chrome keeps writing to its profile until it exits, so wait for that before the profile is removed.
    const exited = new Promise((r) => chrome.once('exit', r));
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill();
    await exited;
  };

  try {
    const { id: extensionId } = await cmd('Extensions.loadUnpacked', { path: resolve('dist') });
    const tab = await attach((await findTarget((t) => t.type === 'page' && !t.url.startsWith('chrome-extension:'))).targetId);
    await cmd('Page.enable', {}, tab);
    await light(tab);
    await viewport(tab, 1280);
    const worker = await attach((await findTarget((t) => t.type === 'service_worker' && t.url.includes(extensionId))).targetId);
    const ours = (path: string) => (t: Target) => t.url.includes(extensionId) && t.url.endsWith(path);
    const prepare = async (session: string) => {
      await light(session);
      if (clock !== undefined) {
        await cmd('Page.enable', {}, session);
        await cmd('Page.addScriptToEvaluateOnNewDocument', { source: clockScript(clock) }, session);
        await cmd('Page.reload', {}, session);
        await sleep(500);
        await waitFor(session, 'document.readyState === "complete"');
      }
      await sleep(2500);
    };

    const go = async (url: string) => {
      await cmd('Page.navigate', { url }, tab);
      for (let attempt = 0; ; attempt++) {
        await waitFor(tab, 'document.readyState === "complete"');
        // A live ReSpec draft adds its logo and other images only once it has rendered.
        await evaluate(tab, 'document.respec ? document.respec.ready.then(() => true) : true');
        // Lazy images below the fold never load, so this wait is a best effort.
        await waitFor(tab, '[...document.images].every((i) => i.complete && i.naturalWidth > 0)', 10_000).catch(() => {});
        // The spec logo from www.w3.org sometimes comes back as a broken image, which a reload with a cold cache fixes.
        const broken = await evaluate(tab, '[...document.images].some((i) => i.loading !== "lazy" && i.complete && i.naturalWidth === 0)');
        if (!broken || attempt === 2) break;
        await cmd('Page.reload', { ignoreCache: true }, tab);
        await sleep(500);
      }
      // Each shot shows a spec's header with its "More details about this document" metadata collapsed.
      await evaluate(tab, `for (const s of document.querySelectorAll('details > summary')) {
        if (s.textContent.trim() === 'More details about this document') s.parentElement.open = false;
      }`);
      await sleep(2500);
    };
    // The footer warns when some live data couldn't be fetched, and a shot of stale data fails the run.
    const failIfStale = async (session: string) => {
      if (await evaluate(session, 'document.body.textContent.includes("couldn\u2019t be fetched")')) {
        throw new Error('the footer warns that some live data couldn\u2019t be fetched');
      }
    };
    // The popup opens in the profile's window by its ID, since with no ID it opens only in a window that has focus.
    const openPopup = async () => {
      const opened = await evaluate(worker, `chrome.windows.getAll({ windowTypes: ['normal'] })
        .then(([w]) => chrome.action.openPopup({ windowId: w.id }))
        .then(() => "ok", (e) => String(e))`);
      if (opened !== 'ok') throw new Error(`openPopup: ${opened}`);
      const target = await findTarget(ours('/popup.html'));
      const session = await attach(target.targetId);
      await prepare(session);
      await failIfStale(session);
      return { target, session };
    };
    // sidePanel.open() needs a user gesture, so the popup's button gets a real mouse click, rather than a script one.
    const openSidePanel = async () => {
      const popup = await openPopup();
      const point = await evaluate(popup.session, `(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /beside the page/.test(x.textContent));
        b.scrollIntoView();
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      await sleep(300);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await cmd('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 }, popup.session);
      }
      const panel = await attach((await findTarget(ours('/sidepanel.html'))).targetId);
      await prepare(panel);
      await failIfStale(panel);
      await sleep(500);
      const width: number = await evaluate(panel, 'innerWidth');
      await viewport(tab, 1280 - width);
      await viewport(panel, width);
      await sleep(1500);
      return { panel, width };
    };
    return { cmd, evaluate, waitFor, capture, tab, go, openPopup, openSidePanel, close };
  } catch (e) {
    await close();
    throw e;
  }
}

// The popup hangs from the top-right corner of the page, with a border and a shadow.
function popupOver(page: string, popup: string, out: string) {
  magick(join(raw, page),
    '(', join(raw, popup), '-bordercolor', '#c9cdd2', '-border', '2',
    '(', '+clone', '-background', '#000', '-shadow', '35x16+0+10', ')', '+swap', '-background', 'none', '-layers', 'merge', '+repage', ')',
    '-gravity', 'northeast', '-geometry', '+40+8', '-composite', '-resize', '1280x800', '-strip', join(work, out));
}

// The side panel sits to the right of the page, behind a 1px divider.
function panelBeside(page: string, panel: string, panelWidth: number, out: string) {
  magick('(', join(raw, page), '-crop', `${(1280 - panelWidth) * 2 - 2}x1600+0+0`, '+repage', ')',
    '(', join(raw, panel), '-gravity', 'west', '-background', '#c9cdd2', '-splice', '2x0', ')',
    '+append', '-resize', '1280x800', '-strip', join(work, out));
}

try {
  const b = await launch('profile');
  try {
    for (const [name, url] of [
      ['card-editors-draft', 'https://w3c.github.io/webappsec-fetch-metadata/'],
      ['version-radar', 'https://www.w3.org/TR/2023/REC-wai-aria-1.2-20230606/'],
      ['github-repo', 'https://github.com/w3c/aria'],
      ['group-page', 'https://www.w3.org/groups/wg/css/'],
    ]) {
      await b.go(url);
      await b.capture(b.tab, `${name}-page`);
      const popup = await b.openPopup();
      await b.capture(popup.session, `${name}-popup`);
      await b.cmd('Target.closeTarget', { targetId: popup.target.targetId });
      await sleep(500);
      popupOver(`${name}-page.png`, `${name}-popup.png`, `${name}.png`);
    }

    // The panels the MDN, Can I Use, and wpt.fyi buttons open, each in the card for CSS Anchor Positioning.
    await b.go('https://drafts.csswg.org/css-anchor-position-1/');
    await b.capture(b.tab, 'refs-page');
    for (const [name, button] of [['mdn-articles', 'mdn'], ['caniuse-features', 'caniuse'], ['wpt-results', 'wpt']]) {
      const popup = await b.openPopup();
      await b.waitFor(popup.session, `!!document.querySelector('.refs button.${button}')`);
      await b.evaluate(popup.session, `document.querySelector('.refs button.${button}').click()`);
      await sleep(1000);
      await b.capture(popup.session, `${name}-popup`);
      await b.cmd('Target.closeTarget', { targetId: popup.target.targetId });
      await sleep(500);
      popupOver('refs-page.png', `${name}-popup.png`, `${name}.png`);
    }

    // The browser-support logos for a spec that Safari doesn't implement, with "What's missing?" open.
    await b.go('https://w3c.github.io/requestidlecallback/');
    await b.capture(b.tab, 'browser-support-page');
    const support = await b.openPopup();
    await b.waitFor(support.session, `!!document.querySelector('.impl button.why')`);
    await b.evaluate(support.session, `document.querySelector('.impl button.why').click()`);
    await sleep(1000);
    await b.capture(support.session, 'browser-support-popup');
    await b.cmd('Target.closeTarget', { targetId: support.target.targetId });
    await sleep(500);
    popupOver('browser-support-page.png', 'browser-support-popup.png', 'browser-support.png');

    // The definition counts in the Fetch standard, with the popover open for "fetch".
    await b.go('https://fetch.spec.whatwg.org/');
    await b.waitFor(b.tab, `!!document.querySelector('[data-wsc-usedby="concept-fetch"]')`);
    await b.evaluate(b.tab, `scrollTo(0, document.getElementById('concept-fetch').getBoundingClientRect().top + scrollY - 230)`);
    await sleep(800);
    await b.evaluate(b.tab, `document.querySelector('[data-wsc-usedby="concept-fetch"]').shadowRoot.querySelector('button').click()`);
    await sleep(800);
    await b.capture(b.tab, 'used-by-counts');
    magick(join(raw, 'used-by-counts.png'), '-resize', '1280x800', '-strip', join(work, 'used-by-counts.png'));

    // The side panel beside a live ReSpec draft.
    await b.go('https://w3c.github.io/aria/');
    const { panel, width } = await b.openSidePanel();
    await b.capture(b.tab, 'side-panel-page');
    await b.capture(panel, 'side-panel-panel');
    panelBeside('side-panel-page.png', 'side-panel-panel.png', width, 'side-panel.png');
  } finally {
    await b.close();
  }

  // TPAC Now and Next in the side panel, beside the TPAC 2026 page, during breakout day.
  const t = await launch('profile-tpac', TPAC_MOMENT);
  try {
    await t.go('https://www.w3.org/news-events/tpac/2026/');
    const { panel, width } = await t.openSidePanel();
    const shown = await t.evaluate(panel, 'new Date().toISOString()');
    if (Math.abs(Date.parse(shown) - TPAC_MOMENT) > 10 * 60_000) throw new Error(`the panel's clock reads ${shown}`);
    await t.waitFor(panel, `!!document.querySelector('.tpac')`);
    await t.evaluate(panel, `(() => {
      const s = document.querySelector('.tpac');
      if (s.getBoundingClientRect().top > innerHeight * 0.4) s.scrollIntoView({ block: 'start' });
    })()`);
    await sleep(500);
    await t.capture(t.tab, 'tpac-page');
    await t.capture(panel, 'tpac-panel');
    panelBeside('tpac-page.png', 'tpac-panel.png', width, 'tpac-now-and-next.png');
  } finally {
    await t.close();
  }

  for (const name of ['card-editors-draft', 'used-by-counts', 'version-radar', 'github-repo', 'group-page',
    'browser-support', 'mdn-articles', 'caniuse-features', 'wpt-results', 'side-panel', 'tpac-now-and-next']) {
    execFileSync('pngquant', ['--quality', '85-98', '--speed', '1', '--strip', '--force', '--output',
      `screenshots/${name}.png`, join(work, `${name}.png`)], { stdio: 'inherit' });
    console.log(`screenshots/${name}.png`);
  }
} finally {
  await rm(work, { recursive: true, force: true, maxRetries: 5 });
}
