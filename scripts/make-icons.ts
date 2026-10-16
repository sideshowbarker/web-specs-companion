import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';

// Renders the extension icons from assets/w3c-symbol.svg, the W3C symbol exactly as published at
// https://www.w3.org/assets/logos/w3c-2025/svg/w3c-symbol.svg — drawn the way www.w3.org draws its own
// apple-touch-icon: the symbol in W3C Blue, 85% of the width of a white disc. Needs ImageMagick (magick).

const SUPERSAMPLE = 8;

const source = await readFile('assets/w3c-symbol.svg', 'utf8');
const [, , boxWidth, boxHeight] = source.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
const paths = [...source.matchAll(/<path\b[^>]*?\bd="([^"]+)"/g)].map((m) => m[1]);

function svg(size: number, padding: number): string {
  const s = size * SUPERSAMPLE;
  const r = (size / 2 - padding) * SUPERSAMPLE;
  const width = r * 2 * 0.85;
  const k = width / boxWidth;
  const x = (s - width) / 2;
  const y = (s - boxHeight * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">` +
    `<circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="#ffffff"/>` +
    `<g fill="#005a9c" transform="translate(${x} ${y}) scale(${k})">` +
    paths.map((d) => `<path d="${d}"/>`).join('') +
    '</g></svg>';
}

await mkdir('static/icons', { recursive: true });
// The 128px icon keeps 16px of transparent padding on each side, as the Chrome Web Store asks.
for (const [size, padding] of [[16, 0], [32, 0], [48, 0], [128, 16]]) {
  execFileSync('magick', [
    '-background', 'none', 'svg:-', '-scale', `${size}x${size}`, '-strip', `PNG32:static/icons/${size}.png`,
  ], { input: svg(size, padding) });
}
