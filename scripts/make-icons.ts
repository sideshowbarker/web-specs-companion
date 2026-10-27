import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

// Renders the extension icons in static/icons/, the Firefox Add-ons listing icon, the App Store's app icons, and the
// Chrome Web Store's small promo tile from assets/globe.svg, the grinning globe the browser-specs.github.io site uses
// for its icon, whole and unaltered except for its size. Needs ImageMagick (magick), and for the tile's text, the
// Arial fonts that macOS installs.

const SOURCE = 'assets/globe.svg';
const BLUE = '#005a9c';
const BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const REGULAR = '/System/Library/Fonts/Supplemental/Arial.ttf';

const magick = (args: string[], input?: Buffer) => execFileSync('magick', args, { input });

// The globe rendered at 2048px across, so that every icon is a downscale, and centered on a transparent square.
const square = magick([
  '-background', 'none', '-density', '700', SOURCE, '-trim', '+repage', '-resize', '2048x2048',
  '-gravity', 'center', '-extent', '2048x2048', 'PNG32:-',
]);

await mkdir('static/icons', { recursive: true });
// The 128px icon keeps 16px of transparent padding on each side, as the Chrome Web Store asks. The two smallest get a
// light unsharp mask, so the globe's lines survive the downscale.
for (const [size, padding] of [[16, 0], [32, 0], [48, 0], [128, 16]]) {
  const inner = size - 2 * padding;
  magick([
    'png:-', '-filter', 'Lanczos', '-resize', `${inner}x${inner}`, ...(size <= 32 ? ['-unsharp', '0x0.6+0.6+0'] : []),
    '-background', 'none', '-gravity', 'center', '-extent', `${size}x${size}`, '-strip', `PNG32:static/icons/${size}.png`,
  ], square);
}

// The Firefox Add-ons listing icon fills the whole 128px square, without the padding: AMO doesn't ask for it, and it
// would make the globe look small beside other add-ons' icons.
magick(['png:-', '-filter', 'Lanczos', '-resize', '128x128', '-strip', 'PNG32:store/amo-icon-128.png'], square);

// The App Store's 1024px app icons each put the whole globe in the middle 824px, as Apple's macOS icon grid does: the
// Mac one on transparency, and the iOS one on white, since an iOS app icon can't have an alpha channel.
for (const [background, out] of [['none', 'PNG32:store/app-icon-1024.png'], ['white', 'PNG24:store/app-icon-ios-1024.png']]) {
  magick([
    '-size', '1024x1024', `xc:${background}`, '(', 'png:-', '-filter', 'Lanczos', '-resize', '824x824', ')',
    '-gravity', 'center', '-composite', ...(background === 'white' ? ['-alpha', 'off'] : []), '-strip', out,
  ], square);
}

// The extension's own 1024px icon is the globe filling the whole square: Safari's packager makes the Mac app's icon
// from it, and sets it on the rounded square that macOS gives every app icon.
magick(['png:-', '-filter', 'Lanczos', '-resize', '1024x1024', '-strip', 'PNG32:static/icons/1024.png'], square);

// The tile puts the globe on W3C Blue, with the name and the tagline beside it.
magick([
  '-size', '440x280', `xc:${BLUE}`,
  '(', 'png:-', '-filter', 'Lanczos', '-resize', '150x150', ')', '-geometry', '+30+65', '-composite',
  '-fill', 'white', '-font', BOLD, '-pointsize', '28',
  '-annotate', '+204+124', 'Browser specs', '-annotate', '+204+158', 'companion',
  '-font', REGULAR, '-pointsize', '14.5',
  '-annotate', '+205+192', 'Specs, groups, and TPAC,', '-annotate', '+205+211', 'wherever you are',
  '-strip', 'PNG24:store/promo-tile-440x280.png',
], square);
