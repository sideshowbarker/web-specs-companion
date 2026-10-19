import { useEffect, useState } from 'preact/hooks';
import type { SearchItem } from '../../logic/search.ts';
import { open, send } from '../api.ts';

export function Search() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      return;
    }
    const t = setTimeout(() => {
      send('search', { query: q }).then((r) => setItems(r.items), () => setItems([]));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  async function go(item: SearchItem, e: MouseEvent) {
    e.preventDefault();
    const url = item.kind === 'idl' && item.idlName ? (await send('resolve-idl', { name: item.idlName })).url : item.url;
    open(url, e);
  }

  return (
    <div class="search" role="search">
      <label for="q">Search web specs</label>
      <input
        id="q"
        type="search"
        value={q}
        autocomplete="off"
        placeholder="Specs, groups, Web IDL, terms"
        onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
      />
      {items.length > 0 && (
        <ul class="results">
          {items.map((i) => (
            <li key={`${i.kind}:${i.url}:${i.label}`}>
              <a href={i.url} onClick={(e) => go(i, e)}>{i.label}</a> <span class="muted">{i.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
