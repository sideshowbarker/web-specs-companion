// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';

const { send, start, render } = vi.hoisted(() => ({ send: vi.fn(), start: vi.fn(), render: vi.fn() }));
vi.mock('../src/shared/browser.ts', () => ({}));
vi.mock('../src/shared/messages.ts', () => ({ send, RESPEC_READY: 'web-specs-companion:respec-ready' }));
vi.mock('../src/shared/settings.ts', () => ({
  getSettings: async () => ({ reviewButton: true, usedBy: false }),
  onSettingsChanged: vi.fn(),
}));
vi.mock('../src/content/review.ts', () => ({ ReviewLayer: class { start = start; } }));
vi.mock('../src/content/usedby.ts', () => ({ UsedByLayer: class { render = render; } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  start.mockResolvedValue(undefined);
  vi.stubGlobal('browser', {
    runtime: { onMessage: { addListener: vi.fn() } },
    storage: { onChanged: { addListener: vi.fn() } },
  });
  document.head.innerHTML = '';
  document.body.innerHTML = `<div class="head"><h1 id="title">A spec</h1>
    <p id="w3c-state">Editor's Draft</p><details><summary>More details</summary></details></div>
    <section id="abstract"><h2>Abstract</h2><p>Spec summary.</p></section>`;
});

afterEach(() => { vi.unstubAllGlobals(); });

it('enhances a recognized W3C header before starting the review layer', async () => {
  send.mockResolvedValue({ shortname: 'example', header: { groupNames: ['Example Working Group'] } });
  start.mockImplementation(async () => {
    expect(document.querySelector('.head #abstract')).not.toBeNull();
  });
  await import('../src/content/spec.ts');
  await vi.waitFor(() => expect(start).toHaveBeenCalled());
  expect(document.querySelector('[data-wsc-group]')?.textContent).toBe('Example Working Group');
});

it('enhances an uncataloged spec whose group is known', async () => {
  send.mockResolvedValue({ header: { groupNames: ['Example Working Group'] } });
  await import('../src/content/spec.ts');
  await vi.waitFor(() => expect(document.querySelector('.head #abstract')).not.toBeNull());
  expect(start).not.toHaveBeenCalled();
});

it('leaves a page unchanged when no header data is returned', async () => {
  send.mockResolvedValue({ shortname: 'example' });
  const html = document.body.innerHTML;
  await import('../src/content/spec.ts');
  await vi.waitFor(() => expect(start).toHaveBeenCalled());
  expect(document.body.innerHTML).toBe(html);
});

it('enhances a WHATWG header using its workstream name', async () => {
  send.mockResolvedValue({ shortname: 'fetch', header: { groupNames: ['Fetch Workstream'] } });
  await import('../src/content/spec.ts');
  await vi.waitFor(() => expect(start).toHaveBeenCalled());
  expect(document.querySelector('[data-wsc-group]')?.textContent).toBe('Fetch Workstream');
  expect(document.querySelector('.head #abstract')).not.toBeNull();
});

it('waits for a live ReSpec draft to finish rendering', async () => {
  // The fixture supplies ReSpec's completion signal without loading or executing the remote script.
  document.head.innerHTML = '<script type="application/json" src="https://www.w3.org/Tools/respec/respec-w3c"></script>';
  send.mockResolvedValue({ shortname: 'example', header: { groupNames: ['Example Working Group'] } });
  await import('../src/content/spec.ts');
  expect(send).not.toHaveBeenCalled();
  expect(document.querySelector('.head #abstract')).toBeNull();
  const generator = document.createElement('meta');
  generator.name = 'generator';
  generator.content = 'ReSpec';
  document.head.append(generator);
  await vi.waitFor(() => expect(document.querySelector('.head #abstract')).not.toBeNull());
});
