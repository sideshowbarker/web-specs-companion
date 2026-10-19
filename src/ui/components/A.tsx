import type { ComponentChildren } from 'preact';
import { open } from '../api.ts';

export function A({ href, title, children }: { href: string; title?: string; children: ComponentChildren }) {
  return (
    <a
      href={href}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        open(href, e);
      }}
    >
      {children}
    </a>
  );
}
