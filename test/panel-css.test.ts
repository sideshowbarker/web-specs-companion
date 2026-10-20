import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { KINDS } from '../src/logic/review.ts';

const css = readFileSync('static/panel.css', 'utf8');

// The custom properties a :root block of the panel's style sheet sets.
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}')));
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const dark = tokens(css.slice(darkStart, css.indexOf('}', darkStart)));

function rgb(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const fn = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(color);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  throw new Error(`can't read ${color}`);
}

// WCAG 2's contrast ratio:
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function contrast(a: string, b: string): number {
  const luminance = (color: string) => {
    const [r, g, b2] = rgb(color).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('the review chips', () => {
  it("keep each kind's text readable on its color, in light and dark mode", () => {
    for (const mode of [light, dark]) {
      for (const kind of KINDS) {
        expect([kind, contrast(mode['--review-chip-fg'], mode[`--review-${kind}`]) >= 4.5]).toEqual([kind, true]);
      }
    }
  });
});
