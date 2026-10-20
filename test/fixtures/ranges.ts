// Ranges over a test page's text, by the strings they start and end with.

export function textNodes(): Text[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

// A range from the start of the first text node holding from, to the end of the first text after that holding to.
export function range(from: string, to: string): Range {
  const nodes = textNodes();
  const start = nodes.findIndex((n) => n.data.includes(from));
  const r = document.createRange();
  r.setStart(nodes[start], nodes[start].data.indexOf(from));
  for (const node of nodes.slice(start)) {
    const offset = node === nodes[start] ? node.data.indexOf(to, r.startOffset) : node.data.indexOf(to);
    if (offset < 0) continue;
    r.setEnd(node, offset + to.length);
    return r;
  }
  throw new Error(`No ${to} after ${from}`);
}
