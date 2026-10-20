// Builds the Mac app for the App Store from dist/ with Safari's packager, then archives it, and with --upload, sends
// it to App Store Connect. App Store Connect's web packager can't do this: For a Mac-only app, it names the app's
// bundle ID after the app, but the extension's after the bundle ID it's given, so the extension's ID doesn't start
// with the app's, and the export fails. Takes --build N for a version's second and later uploads. Needs Xcode, signed
// in to the developer's Apple Account.
import { execFileSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const NAME = 'Web Specs Companion';
const BUNDLE_ID = 'net.sideshowbarker.WebSpecsCompanion';
const TEAM = 'C3DGD38MM6';
const CATEGORY = 'public.app-category.developer-tools';
const OUT = 'artifacts/mac';

export type ProjectOptions = { bundleId: string; version: string; build: number };

// Fixes what the packager gets wrong in the project.pbxproj it generates: the app's bundle ID, the version (it sets
// 1.0 whatever the manifest says), and the app's category, which the App Store requires of a Mac app.
export function fixProject(project: string, { bundleId, version, build }: ProjectOptions): string {
  const extensionId = `${bundleId}.Extension`;
  let apps = 0;
  let extensions = 0;
  const fixed = project.replace(/buildSettings = \{[^}]*\};/g, (block) => {
    const id = /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/.exec(block)?.[1];
    if (id === undefined) return block;
    if (id === extensionId) {
      extensions++;
      return block;
    }
    apps++;
    return block
      .replace(/\n\t*INFOPLIST_KEY_LSApplicationCategoryType = [^;]+;/, '')
      .replace(
        /\n(\t*)PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/,
        `\n$1INFOPLIST_KEY_LSApplicationCategoryType = "${CATEGORY}";\n$1PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`,
      );
  });
  if (extensions === 0) throw new Error(`The project has no extension with the bundle ID ${extensionId}`);
  if (apps === 0) throw new Error('The project has no app target');
  return fixed
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
}

const EXPORT_OPTIONS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>${TEAM}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
`;

async function main() {
  const { values: args } = parseArgs({
    options: { build: { type: 'string', default: '1' }, upload: { type: 'boolean', default: false } },
  });
  const build = Number(args.build);
  if (!Number.isInteger(build) || build < 1) throw new Error(`--build takes a positive integer, not ${args.build}`);
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));

  // App Store Connect turns away builds made with a beta Xcode, so this uses the release one unless DEVELOPER_DIR names
  // another, and checks that it isn't a beta, whose build numbers end in a letter.
  const developerDir = process.env.DEVELOPER_DIR ?? '/Applications/Xcode.app/Contents/Developer';
  const env = { ...process.env, DEVELOPER_DIR: developerDir };
  const xcode = execFileSync('plutil', ['-extract', 'ProductBuildVersion', 'raw', `${developerDir}/../version.plist`])
    .toString()
    .trim();
  if (args.upload && /[a-z]$/.test(xcode)) throw new Error(`The Xcode in ${developerDir} is a beta, ${xcode}`);
  const run = (command: string, commandArgs: string[]) => execFileSync(command, commandArgs, { env, stdio: 'inherit' });

  await rm(OUT, { recursive: true, force: true });
  run('xcrun', [
    'safari-web-extension-packager', '--project-location', `${OUT}/project`, '--app-name', NAME,
    '--bundle-identifier', BUNDLE_ID, '--swift', '--macos-only', '--copy-resources', '--no-open', '--no-prompt',
    '--force', 'dist',
  ]);
  const project = `${OUT}/project/${NAME}/${NAME}.xcodeproj`;
  const pbxproj = `${project}/project.pbxproj`;
  await writeFile(pbxproj, fixProject(await readFile(pbxproj, 'utf8'), { bundleId: BUNDLE_ID, version, build }));

  const archive = `${OUT}/${NAME}.xcarchive`;
  run('xcodebuild', [
    '-quiet', '-project', project, '-scheme', NAME, '-configuration', 'Release',
    '-destination', 'generic/platform=macOS', '-derivedDataPath', `${OUT}/derived`, '-archivePath', archive,
    '-allowProvisioningUpdates', `DEVELOPMENT_TEAM=${TEAM}`, 'archive',
  ]);
  if (!args.upload) {
    console.log(`${archive}/Products/Applications/${NAME}.app`);
    return;
  }
  await writeFile(`${OUT}/ExportOptions.plist`, EXPORT_OPTIONS);
  run('xcodebuild', [
    '-exportArchive', '-archivePath', archive, '-exportOptionsPlist', `${OUT}/ExportOptions.plist`, '-exportPath',
    `${OUT}/export`, '-allowProvisioningUpdates',
  ]);
  console.log(`Uploaded ${NAME} ${version} (${build})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
