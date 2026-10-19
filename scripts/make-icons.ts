import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

// Renders the extension icons in static/icons/, the Firefox Add-ons listing icon, and the Chrome Web Store's small
// promo tile from assets/avatar.png, the maintainer's GitHub avatar, whole and unaltered except for its size. Needs
// ImageMagick (magick), and for the tile's text, the Arial fonts that macOS installs.

const SOURCE = 'assets/avatar.png';
const BLUE = '#005a9c';
const BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const REGULAR = '/System/Library/Fonts/Supplemental/Arial.ttf';

const magick = (args: string[], input?: Buffer) => execFileSync('magick', args, { input });

// The avatar trimmed of its transparent margin, and centered on a transparent square.
const [w, h] = magick([SOURCE, '-trim', '-format', '%w %h', 'info:']).toString().split(' ').map(Number);
const side = Math.max(w, h);
const square = magick([SOURCE, '-trim', '+repage', '-background', 'none', '-gravity', 'center', '-extent', `${side}x${side}`, 'PNG32:-']);

await mkdir('static/icons', { recursive: true });
// The 128px icon keeps 16px of transparent padding on each side, as the Chrome Web Store asks. The two smallest get a
// light unsharp mask, so the avatar's outlines survive the downscale.
for (const [size, padding] of [[16, 0], [32, 0], [48, 0], [128, 16]]) {
  const inner = size - 2 * padding;
  magick([
    'png:-', '-filter', 'Lanczos', '-resize', `${inner}x${inner}`, ...(size <= 32 ? ['-unsharp', '0x0.6+0.6+0'] : []),
    '-background', 'none', '-gravity', 'center', '-extent', `${size}x${size}`, '-strip', `PNG32:static/icons/${size}.png`,
  ], square);
}

// The Firefox Add-ons listing icon fills the whole 128px square, without the padding: AMO doesn't ask for it, and it
// would make the avatar look small beside other add-ons' icons.
magick(['png:-', '-filter', 'Lanczos', '-resize', '128x128', '-strip', 'PNG32:store/amo-icon-128.png'], square);

// The tile puts the avatar on a white disc, since on bare W3C Blue its dark outlines and strokes all but vanish, with
// the name and the tagline beside it.
magick([
  '-size', '440x280', `xc:${BLUE}`, '-fill', 'white', '-draw', 'circle 116,140 116,60',
  '(', 'png:-', '-filter', 'Lanczos', '-resize', '120x120', ')', '-geometry', '+56+80', '-composite',
  '-fill', 'white', '-font', BOLD, '-pointsize', '30',
  '-annotate', '+222+124', 'Web Specs', '-annotate', '+222+160', 'Companion',
  '-font', REGULAR, '-pointsize', '14.5',
  '-annotate', '+223+194', 'Specs, groups, and TPAC,', '-annotate', '+223+213', 'wherever you are',
  '-strip', 'PNG24:store/promo-tile-440x280.png',
], square);
