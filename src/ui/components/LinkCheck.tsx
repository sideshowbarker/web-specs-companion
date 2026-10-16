import { useState } from 'preact/hooks';
import type { LinkCheckResult } from '../../logic/linkcheck.ts';
import { sendToTab } from '../api.ts';
import { A } from './A.tsx';

type State = { status: 'idle' | 'running' } | { status: 'done'; result: LinkCheckResult } | { status: 'error'; error: string };

export function LinkCheck({ tabId }: { tabId: number }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  async function run() {
    setState({ status: 'running' });
    try {
      setState({ status: 'done', result: await sendToTab(tabId, 'run-link-check', {}) });
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return (
    <div class="linkcheck">
      <button type="button" onClick={run} disabled={state.status === 'running'}>
        {state.status === 'running' ? 'Checking links…' : 'Check links to other specs'}
      </button>
      <div aria-live="polite">
        {state.status === 'error' && <p class="warn">{state.error}</p>}
        {state.status === 'done' && (
          <>
            <p>
              {state.result.problems.length === 0
                ? `All ${state.result.checked} links to other specs resolve.`
                : `${state.result.problems.length} of ${state.result.checked} links to other specs point at anchors that don\u2019t exist.`}
              {state.result.crawlDate ? ` Webref data from ${state.result.crawlDate}.` : ''}
            </p>
            <ul class="problems">
              {state.result.problems.map((p) => (
                <li key={p.i}>
                  <button type="button" class="linkish" onClick={() => sendToTab(tabId, 'reveal-link', { i: p.i })}>
                    {p.text || p.href}
                  </button>{' '}
                  in {p.target.title}
                  {p.suggestion && <> — maybe <A href={p.suggestion}>{new URL(p.suggestion).hash}</A></>}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => { sendToTab(tabId, 'clear-link-check', {}).catch(() => {}); setState({ status: 'idle' }); }}>
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
