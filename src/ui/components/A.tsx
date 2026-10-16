import type { ComponentChildren } from 'preact';
import { open } from '../api.ts';

export function A({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        open(href, e);
      }}
    >
      {children}
    </a>
  );
}
