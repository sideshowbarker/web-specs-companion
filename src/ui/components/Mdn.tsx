import { useRef, useState } from 'preact/hooks';
import { filterItems, MDN_DOCS, type MdnItem, type MdnView } from '../../logic/mdn.ts';
import { formatDate } from '../format.ts';
import { A } from './A.tsx';

// MDN Web Docs' mark: The path in Simple Icons 16.35.0's icons/mdnwebdocs.svg, which is CC0 1.0. MDN Web Docs and its
// mark are Mozilla's trademarks, and the card uses the mark only to link to MDN.
const MARK = 'm21.538 1.1-6.745 21.8h-2.77L18.77 1.1ZM24 1.1v21.8h-2.462V1.1Zm-12 0v21.8H9.538V1.1Zm-2.462 0L2.77 22.9H0L6.746 1.1Z';

// The sections start open when the spec has at most OPEN_UP_TO top-level articles, and a list of more than
// FILTER_ABOVE articles gets a filter box.
const OPEN_UP_TO = 12;
const FILTER_ABOVE = 40;

const articles = (n: number) => (n === 1 ? '1 MDN article' : `${n} MDN articles`);
const plain = (title: string) => title.replace(/`/g, '');
const childrenId = (item: MdnItem) => `mdn:${item.url.slice(MDN_DOCS.length)}`;

function flip(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

// Renders the text between a title's backticks as code.
function Title({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

export function MdnButton({ view, open, onToggle }: { view: MdnView; open: boolean; onToggle: () => void }) {
  const label = articles(view.count);
  return (
    <button type="button" class="linkish mdn" aria-expanded={open} aria-controls="mdn-list" aria-label={label} title={label} onClick={onToggle}>
      <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
        <path fill="currentColor" d={MARK} />
      </svg>
      {view.count}
    </button>
  );
}

// Each item links to its page, and an item with members gets a toggle for them. While the filter has text, every
// toggle on a match's path is open, and can't be closed.
function Items({ items, filtering, expanded, onExpand }: {
  items: MdnItem[];
  filtering: boolean;
  expanded: Set<string>;
  onExpand: (url: string) => void;
}) {
  return (
    <ul>
      {items.map((item) => {
        const open = filtering || expanded.has(item.url);
        const n = item.count;
        return (
          <li key={item.url}>
            <A href={item.url}><Title text={item.title} /></A>
            {item.children.length > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  class="linkish members"
                  aria-expanded={open}
                  aria-controls={childrenId(item)}
                  aria-label={`${n} ${n === 1 ? 'article' : 'articles'} under ${plain(item.title)}`}
                  disabled={filtering}
                  onClick={() => onExpand(item.url)}
                >
                  {n}
                </button>
                <div id={childrenId(item)} hidden={!open}>
                  {open && <Items items={item.children} filtering={filtering} expanded={expanded} onExpand={onExpand} />}
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Articles({ view }: { view: MdnView }) {
  const top = view.sections.reduce((n, s) => n + s.items.length, 0);
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState(() => new Set(top <= OPEN_UP_TO ? view.sections.map((s) => s.name) : []));
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const filtering = query.trim() !== '';
  // Opening a section for the filter fires its toggle event too, which mustn't count as the reader's choice, so the
  // handler reads the filter from here, rather than from the render that attached it.
  const filteringNow = useRef(filtering);
  filteringNow.current = filtering;
  const sections = view.sections.map((s) => ({ ...s, items: filterItems(s.items, query) })).filter((s) => s.items.length > 0);
  return (
    <>
      <p><strong>{articles(view.count)}</strong></p>
      {view.fromSeries && (
        <p class="muted">{`This spec has no MDN articles of its own, so these are the ones for ${view.fromSeries.title}.`}</p>
      )}
      {view.overviews.length > 0 && (
        <p>
          {view.overviews.length === 1 ? 'Overview: ' : 'Overviews: '}
          {view.overviews.map((o, i) => (
            <span key={o.url}>{i > 0 && ', '}<A href={o.url}><Title text={o.title} /></A></span>
          ))}
        </p>
      )}
      {view.count > FILTER_ABOVE && (
        <input
          type="search"
          class="mdn-filter"
          placeholder="Filter articles"
          aria-label="Filter articles"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
      )}
      {sections.map((s) => (
        <details
          key={s.name}
          open={filtering || openSections.has(s.name)}
          onToggle={(e) => {
            const isOpen = (e.currentTarget as HTMLDetailsElement).open;
            if (!filteringNow.current) setOpenSections((cur) => (isOpen === cur.has(s.name) ? cur : flip(cur, s.name)));
          }}
        >
          <summary>{`${s.name} (${s.items.length})`}</summary>
          {(filtering || openSections.has(s.name)) && (
            <Items items={s.items} filtering={filtering} expanded={expanded} onExpand={(url) => setExpanded((cur) => flip(cur, url))} />
          )}
        </details>
      ))}
      {filtering && sections.length === 0 && <p>No articles match.</p>}
      <p class="muted">
        From <A href="https://github.com/mdn/content">MDN</A>, as of {formatDate(view.content.date)}.
      </p>
    </>
  );
}

// The list under the row, whose contents render only once it's first opened, so a long list costs nothing until then.
export function MdnPanel({ view, open }: { view: MdnView; open: boolean }) {
  const opened = useRef(false);
  if (open) opened.current = true;
  return (
    <div id="mdn-list" class="mdn-list" hidden={!open}>
      {opened.current && <Articles view={view} />}
    </div>
  );
}
