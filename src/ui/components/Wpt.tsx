import { useRef } from 'preact/hooks';
import {
  allUrl, BROWSER_NAMES, dirUrl, formatPct, onlyUrl, passRate, roundPct, runsSentence, subtests, tint, WPT_BROWSERS,
  type WptAnswer, type WptBrowser, type WptFile, type WptSpec, type WptStats,
} from '../../logic/wpt.ts';
import { formatDate } from '../format.ts';
import { A } from './A.tsx';

const LOGOS: Record<WptBrowser, string> = { firefox: 'icons/browsers/firefox.svg', safari: 'icons/browsers/safari.svg', chrome: 'icons/browsers/chrome.svg' };

const INTEROP = 'Interop: each test\u2019s lowest pass rate of the three, averaged over the tests';

const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

// The logo is wpt.fyi's own, under the W3C 3-clause BSD license in static/icons/wpt-LICENSE.txt (see the README).
export function WptButton({ answer, open, onToggle }: { answer: WptAnswer; open: boolean; onToggle: () => void }) {
  const { interop, tests } = answer.spec.all;
  const label = `Interop ${formatPct(interop)}% across ${count(tests, 'test', 'tests')} on wpt.fyi`;
  return (
    <button type="button" class="linkish wpt" aria-expanded={open} aria-controls="wpt-list" aria-label={label} title={label} onClick={onToggle}>
      <img src="icons/wpt.svg" width={16} height={16} alt="" />
      {`${roundPct(interop)}%`}
    </button>
  );
}

function Row({ name, href, stats, total }: { name: string; href: string; stats: WptStats; total?: boolean }) {
  return (
    <tr class={total ? 'total' : undefined}>
      <th scope="row">
        <A href={href}>{name}</A> <span class="muted">{stats.tests.toLocaleString('en-US')}</span>
      </th>
      {WPT_BROWSERS.map((b) => {
        const rate = passRate(stats.pass[b]);
        return <td key={b} class={tint(rate)} title={subtests(stats.pass[b])}>{formatPct(rate)}</td>;
      })}
      <td class={tint(stats.interop)} title={INTEROP}>{formatPct(stats.interop)}</td>
    </tr>
  );
}

// Each browser's count of the tests it fails while the other two pass, linked to wpt.fyi's view of exactly those tests.
function OnlyLine({ spec, runs }: { spec: WptSpec; runs: WptFile['runs'] }) {
  const { only } = spec.all;
  if (WPT_BROWSERS.every((b) => only[b] === 0)) return null;
  return (
    <p class="wpt-only">
      Fail in only one browser:{' '}
      {WPT_BROWSERS.map((b) => {
        const others = WPT_BROWSERS.filter((o) => o !== b).map((o) => BROWSER_NAMES[o]).join(' and ');
        return (
          <A key={b} href={onlyUrl(spec, b, runs)} title={`Tests where ${BROWSER_NAMES[b]} fails something ${others} pass`}>
            <img src={LOGOS[b]} width={12} height={12} alt={BROWSER_NAMES[b]} />
            {only[b].toLocaleString('en-US')}
          </A>
        );
      })}
    </p>
  );
}

function Results({ answer }: { answer: WptAnswer }) {
  const { spec, runs } = answer;
  return (
    <>
      <table class="wpt-table">
        <caption>
          <strong>{count(spec.all.tests, 'test', 'tests')}</strong> <span class="muted">% of subtests passing</span>
        </caption>
        <thead>
          <tr>
            <td></td>
            {WPT_BROWSERS.map((b) => (
              <th key={b} scope="col"><img src={LOGOS[b]} width={14} height={14} alt={BROWSER_NAMES[b]} /></th>
            ))}
            <th scope="col">Interop</th>
          </tr>
        </thead>
        <tbody>
          <Row name="All tests" href={allUrl(spec, runs)} stats={spec.all} total />
          {(spec.dirs ?? []).map(([dir, stats]) => <Row key={dir} name={`${dir}/`} href={dirUrl(spec, dir, runs)} stats={stats} />)}
        </tbody>
      </table>
      <OnlyLine spec={spec} runs={runs} />
      {answer.fromSeries && <p class="muted">{`This spec has no test results of its own, so these are the ones for ${answer.fromSeries.title}.`}</p>}
      <p class="muted">
        From <A href="https://wpt.fyi/">wpt.fyi</A>: {runsSentence(runs)}, at WPT {answer.revision.slice(0, 10)}, {formatDate(answer.date)}.
      </p>
    </>
  );
}

export function WptPanel({ answer, open }: { answer: WptAnswer; open: boolean }) {
  const opened = useRef(false);
  if (open) opened.current = true;
  return (
    <div id="wpt-list" class="wpt-list" hidden={!open}>
      {opened.current && <Results answer={answer} />}
    </div>
  );
}
