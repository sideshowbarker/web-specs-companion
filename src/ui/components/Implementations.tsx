import type { Engine, ImplFeature, ImplView } from '../../logic/implementations.ts';
import { formatDate } from '../format.ts';
import { A } from './A.tsx';

const BROWSERS: { engine: Engine; name: string; logo: string }[] = [
  { engine: 'gecko', name: 'Firefox', logo: 'icons/browsers/firefox.svg' },
  { engine: 'webkit', name: 'Safari', logo: 'icons/browsers/safari.svg' },
  { engine: 'blink', name: 'Chrome', logo: 'icons/browsers/chrome.svg' },
];

const CORE = { shared: 'at least two engines ship', any: 'any engine ships' };

// How much of the core an engine ships, e.g. "ships 3 of the 21 features at least two engines ship".
function shipped(impl: ImplView, engine: Engine): string {
  const core = CORE[impl.basis === 'any' ? 'any' : 'shared'];
  if (impl.core === 1) return `${impl.ships[engine] ? 'ships' : 'doesn\u2019t ship'} the one feature ${core}`;
  return `ships ${impl.ships[engine]} of the ${impl.core} features ${core}`;
}

function noneShip(impl: ImplView): string {
  return impl.core === 1
    ? 'No engine ships the one feature BCD lists for this spec'
    : `No engine ships any of the ${impl.core} features BCD lists for this spec`;
}

function tooltip(impl: ImplView, engine: Engine, name: string): string {
  const text = impl.basis === 'none' ? noneShip(impl) : `${name}: ${shipped(impl, engine)}`;
  return impl.fromSeries ? `${text} (from the data for ${impl.fromSeries.title})` : text;
}

// The slot keeps its width when it's empty, so "What's missing?" never moves.
function Check({ count }: { count: number }) {
  if (count < 2) return <span class="check" aria-hidden="true" />;
  const label = count === 3 ? 'Implemented in all three engines' : 'Implemented in two of the three engines';
  return (
    <span class={count === 3 ? 'check all' : 'check two'} role="img" aria-label={label} title={label}>
      {'\u2714\uFE0E'}
    </span>
  );
}

function Lacking({ list }: { list?: { features: ImplFeature[]; more: number } }) {
  if (!list) return null;
  return (
    <ul>
      {list.features.map((f) => (
        <li key={f.key}>{f.mdn ? <A href={f.mdn}><code>{f.key}</code></A> : <code>{f.key}</code>}</li>
      ))}
      {list.more > 0 && <li>and {list.more} more</li>}
    </ul>
  );
}

// The list of what each gray engine lacks, which "What's missing?" opens below the row. There's none when all three
// engines implement the spec.
export function Why({ impl, hidden }: { impl: ImplView; hidden: boolean }) {
  if (impl.engines.length === 3) return null;
  const gray = BROWSERS.filter((b) => !impl.engines.includes(b.engine));
  return (
    <div id="impl-why" class="impl-why" hidden={hidden}>
      {impl.basis === 'none' ? (
        <>
          <p>{`${noneShip(impl)}:`}</p>
          <Lacking list={impl.lacks.gecko} />
        </>
      ) : (
        gray.map((b) => (
          <div key={b.engine}>
            <p>{`${b.name} ${shipped(impl, b.engine)}. It lacks:`}</p>
            <Lacking list={impl.lacks[b.engine]} />
          </div>
        ))
      )}
      {impl.fromSeries && (
        <p class="muted">{`This spec has no data of its own, so this is from the data for ${impl.fromSeries.title}.`}</p>
      )}
      <p class="muted">
        From <A href="https://github.com/mdn/browser-compat-data">BCD</A> {impl.bcd.version}, {formatDate(impl.bcd.timestamp.slice(0, 10))}.
      </p>
    </div>
  );
}

// Firefox, Safari, and Chrome logos, in color for each engine that implements the spec and gray for each that doesn't,
// then a check mark when two or three do, and, when any logo is gray, a "What's missing?" button that opens Why.
export function Implementations({ impl, open, onToggle }: { impl: ImplView; open: boolean; onToggle: () => void }) {
  return (
    <div class="impl">
      {BROWSERS.map((b) => {
        const yes = impl.engines.includes(b.engine);
        return (
          <img
            key={b.engine}
            src={b.logo}
            width={20}
            height={20}
            class={yes ? undefined : 'no'}
            alt={`${b.name}: ${yes ? 'implements it' : 'doesn\u2019t implement it'}`}
            title={tooltip(impl, b.engine, b.name)}
          />
        );
      })}
      <Check count={impl.engines.length} />
      {impl.engines.length < 3 && (
        <button type="button" class="linkish why" aria-expanded={open} aria-controls="impl-why" onClick={onToggle}>
          {'What\u2019s missing?'}
        </button>
      )}
    </div>
  );
}
