// Installs dist/ in Firefox through WebDriver BiDi's webExtension.install (the command the WebExtensions spec's
// WebDriver section mirrors), then loads a Bikeshed spec and a live ReSpec draft, and waits for the in-page "used by"
// counts on each, which exercises the manifest, both content scripts, the background, and the live webref fetches. Back
// on Fetch, it then comments on one of the spec's steps, through the page's own Comment button and editor, and waits
// for that comment's highlight.
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const firefox = process.env.FIREFOX ?? '/Applications/Firefox.app/Contents/MacOS/firefox';
const port = 9333;
const profile = await mkdtemp(join(tmpdir(), 'wsc-ff-'));
const ff = spawn(firefox, ['--headless', '--remote-debugging-port', String(port), '--profile', profile, '--no-remote'], { stdio: 'ignore' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connect(): Promise<WebSocket> {
  for (let i = 0; i < 100; i++) {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
      await new Promise((ok, fail) => {
        ws.onopen = ok;
        ws.onerror = fail;
      });
      return ws;
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Firefox did not start its WebDriver BiDi server');
}

const ws = await connect();
let nextId = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pending = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void }>();
ws.onmessage = (ev) => {
  const msg = JSON.parse(String(ev.data));
  const p = msg.id !== undefined ? pending.get(msg.id) : undefined;
  if (!p) return;
  pending.delete(msg.id);
  if (msg.type === 'error') p.fail(new Error(`${msg.error}: ${msg.message}`));
  else p.ok(msg.result);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cmd = (method: string, params: object) =>
  new Promise<any>((ok, fail) => {
    const id = ++nextId;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params }));
  });

try {
  await cmd('session.new', { capabilities: {} });
  const installed = await cmd('webExtension.install', { extensionData: { type: 'path', path: resolve('dist') } });
  console.log('installed', installed.extension);
  const { contexts } = await cmd('browsingContext.getTree', {});
  const context = contexts[0].context;
  for (const url of ['https://fetch.spec.whatwg.org/', 'https://w3c.github.io/aria/']) {
    await cmd('browsingContext.navigate', { context, url, wait: 'complete' });
    let count = 0;
    for (let i = 0; i < 60 && count === 0; i++) {
      const r = await cmd('script.evaluate', {
        expression: "document.querySelectorAll('[data-wsc-usedby]').length",
        target: { context },
        awaitPromise: false,
      });
      count = r.result?.value ?? 0;
      if (count === 0) await sleep(1000);
    }
    if (count === 0) throw new Error(`no used-by counts appeared on ${url}`);
    console.log(`ok: ${count} used-by counts on ${url}`);
  }

  const until = async (expression: string, failure: string) => {
    for (let i = 0; i < 30; i++) {
      const r = await cmd('script.evaluate', { expression, target: { context }, awaitPromise: false });
      if (r.result?.value === true) return;
      await sleep(1000);
    }
    throw new Error(failure);
  };
  const fetchUrl = 'https://fetch.spec.whatwg.org/';
  await cmd('browsingContext.navigate', { context, url: fetchUrl, wait: 'complete' });
  await until("document.querySelectorAll('[data-wsc-usedby]').length > 0", `no used-by counts appeared on ${fetchUrl}`);
  // The selection is made again on each try, since the page script may start listening for it only after the first.
  await until(`(() => {
    const p = document.querySelector('div.algorithm ol > li p');
    if (!p) return false;
    const r = document.createRange();
    r.selectNodeContents(p);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    document.dispatchEvent(new Event('selectionchange'));
    const host = document.querySelector('[data-wsc-review="button"]');
    const button = host?.shadowRoot?.querySelector('button');
    if (!button || host.hidden) return false;
    button.click();
    return true;
  })()`, `no Comment button appeared on ${fetchUrl}`);
  await until(`(() => {
    const editor = document.querySelector('[data-wsc-review="editor"]')?.shadowRoot;
    if (!editor) return false;
    const text = editor.querySelector('textarea');
    text.value = 'e2e';
    text.dispatchEvent(new Event('input'));
    [...editor.querySelectorAll('button')].find((b) => b.textContent === 'Save').click();
    return true;
  })()`, `no comment editor opened on ${fetchUrl}`);
  await until("CSS.highlights.has('wsc-review-comment')", `no comment highlight appeared on ${fetchUrl}`);
  console.log(`ok: a comment's highlight on ${fetchUrl}`);
} finally {
  ws.close();
  ff.kill();
}
