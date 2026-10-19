// Zips dist/ for the stores, and the source tree for AMO's source-code review.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('artifacts', { recursive: true });
const ext = `artifacts/web-specs-companion-${version}.zip`;
const src = `artifacts/web-specs-companion-${version}-source.zip`;
await rm(ext, { force: true });
await rm(src, { force: true });
execFileSync('zip', ['-qr', `../${ext}`, '.'], { cwd: 'dist', stdio: 'inherit' });
execFileSync('git', ['archive', '--format=zip', '-o', src, 'HEAD'], { stdio: 'inherit' });
console.log(ext);
console.log(src);
