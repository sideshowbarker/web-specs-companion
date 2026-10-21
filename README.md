# Web Specs Companion

A browser extension for reading web specs. On any spec — from W3C, WHATWG, or another standards body — it shows a detailed “cheatsheet” of all that’s known about it:

- **The card:** the spec’s type (Living Standard, Editor’s Draft, Working Draft, Candidate Recommendation, etc.), related drafts, its repository and issues, its tests, and the group responsible for it.
- **Browser support:** Firefox, Safari, and Chrome logos, each in color when that browser’s engine implements the spec and gray when it doesn’t, going by MDN’s [browser-compat-data](https://github.com/mdn/browser-compat-data). For a gray one, **What’s missing?** lists the features it lacks.
- **MDN:** a button with the number of the spec’s [MDN](https://developer.mozilla.org/) articles, which opens them, grouped by kind: interfaces, CSS properties, and more.
- **Can I Use:** a button with the number of the spec’s [Can I Use](https://caniuse.com/) features, which opens each one’s global support, and a timeline of when Firefox, Safari, and Chrome shipped it.
- **wpt.fyi:** a button with the interop score of the spec’s web-platform-tests on [wpt.fyi](https://wpt.fyi/), which opens their pass rates in each browser, by test directory, and the tests that fail in only one browser.
- **Spec intelligence from [webref](https://github.com/w3c/webref):** how many other specs use each definition (what [specdex](https://dontcallmedom.github.io/specdex/) shows, in the page you’re reading), the spec’s platform footprint, and a check of its links to other specs for anchors that no longer exist (one of [strudy](https://github.com/w3c/strudy)’s checks, run live).
- **Search:** type `spec` and a space in the address bar to search specs, groups, Web IDL names ([webidlpedia](https://dontcallmedom.github.io/webidlpedia/)), and terms (ReSpec’s xref service).
- **Copying steps:** a copy of an algorithm’s steps keeps each step’s number, as the spec shows it, with nested steps indented, ready to paste into a code comment.
- **Reviewing a spec:** select text in a spec and comment on it. Each comment keeps its quote, the section and step it’s in, and a link that lands on the quoted words. It stays highlighted in the page and listed in the popup and side panel, and files as a GitHub issue against the spec’s repository, which the list then marks with the day it was filed. Or file the whole review as one issue, or copy it as Markdown.
- **Extra details for W3C specs:** its TR versions and publication history, and its group’s chairs, team contacts, and charter end date.
- **Version radar for W3C specs:** whether you’re reading a dated snapshot, whether a newer level exists, and how far the latest TR version lags the draft.
- **On W3C repos and group pages:** for a W3C repo on GitHub, the group behind it and the specs it hosts; for a w3.org group page, the group’s specs.
- **TPAC 2026:** what’s in session now and next, and when each group meets.

Web Specs Companion isn’t formally affiliated with or endorsed by W3C, WHATWG, or any other standards body.

## Screenshots

![The card for an editor’s draft: its maturity, its links, its group and chairs, and its platform footprint](screenshots/card-editors-draft.png)

![The Fetch standard with a count beside each definition, and the list of specs that use “fetch”](screenshots/used-by-counts.png)

![The version radar on a dated snapshot of WAI-ARIA 1.2, pointing at the latest TR version and a newer level](screenshots/version-radar.png)

More: [what Safari lacks of requestIdleCallback()](screenshots/browser-support.png), [the MDN articles](screenshots/mdn-articles.png), [the Can I Use features](screenshots/caniuse-features.png), and [the wpt.fyi results](screenshots/wpt-results.png) for CSS Anchor Positioning, [a W3C repo on GitHub](screenshots/github-repo.png), [a w3.org group page](screenshots/group-page.png), [the side panel beside a live ReSpec draft](screenshots/side-panel.png), and [TPAC Now and Next on breakout day](screenshots/tpac-now-and-next.png).

## Install

The [Web Specs Companion website](https://sideshowbarker.net/web-specs-companion/) has these steps too, with the steps for your browser first.

Chrome and other Chromium-based browsers install Web Specs Companion from the [Chrome Web Store](https://chromewebstore.google.com/detail/hpajpmapkffhaiggemaeajpkehfnapkm). It isn’t on Firefox Add-ons yet, so Firefox installs it from the [latest release](https://github.com/sideshowbarker/web-specs-companion/releases/latest), as Safari does. It needs Chrome or Edge 148 or later, Firefox 128 or later, or Safari 26 or later.

### Chrome, Edge, and other Chromium-based browsers

[Add it to Chrome](https://chromewebstore.google.com/detail/hpajpmapkffhaiggemaeajpkehfnapkm). The Chrome Web Store installs it, and keeps it up to date. Edge, Brave, and other Chromium-based browsers install it from there too — Edge first asks you to allow extensions from other stores.

### Firefox

1. In Firefox, click `web-specs-companion-<version>.xpi` in the latest release, and allow the installation when Firefox asks.
2. Or download the `.xpi`, open `about:addons`, click the gear button, choose **Install Add-on From File…**, and select it.

The `.xpi` is the file Firefox Add-ons signed and serves for that version, so it stays installed after Firefox restarts, and Firefox keeps it up to date from Firefox Add-ons.

### Safari

Safari 26 or later can run Web Specs Companion as a temporary extension, from the zip in the latest release. Safari removes a temporary extension when it quits, and after 24 hours, so add it again whenever it’s gone. Safari has no address-bar keywords or side panels for extensions, so the `spec` keyword and **Keep this open beside the page** aren’t there.

Once, in Safari, choose **Safari** → **Settings…**, select **Advanced**, and turn on **Show features for web developers**. Then, each time:

1. Download `web-specs-companion-<version>.zip` from the latest release, if you don’t have it already.
2. In **Safari** → **Settings…**, select **Developer**, click **Add Temporary Extension…**, and select the zip. Authenticate if Safari asks to allow unsigned extensions.
3. Safari shows a warning sign on the extension’s toolbar button until you allow it on a website. Click the button, and allow it on that website or on every website. On every website, the definition counts and the link check work on every spec site the extension knows.

To update it, remove it from the **Temporary** list in **Settings…** → **Extensions**, and add the newer zip.

## Develop

```sh
npm ci
npm run snapshot     # refresh the data bundled in data/
npm run build        # build into dist/
npm run site         # build the website into _site/
npm test
npm run screenshots  # regenerate screenshots/ (needs Chrome, ImageMagick, and pngquant)
```

Load `dist/` as an unpacked extension (chrome://extensions, Developer mode) or as a temporary add-on in Firefox (about:debugging → This Firefox → Load Temporary Add-on → `dist/manifest.json`).

### Releasing

Bump `version` in `package.json`, commit, and push a matching tag (`v1.0.1` for version 1.0.1). The [Release workflow](.github/workflows/release.yml) then:

- publishes a GitHub release with the zip and the source zip;
- submits the version to Firefox Add-ons, and attaches the signed `.xpi` to the release once Firefox Add-ons approves it — if that takes more than an hour, run the [Attach Firefox build workflow](.github/workflows/attach-firefox-build.yml) later;
- uploads the zip to the Chrome Web Store, and submits it for review;
- points the website’s download links at the release.

That needs these repository secrets: `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`, from the [Firefox Add-ons API key page](https://addons.mozilla.org/developers/addon/api/key/); and `CWS_EXTENSION_ID`, `CWS_PUBLISHER_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, and `CWS_REFRESH_TOKEN`, as [chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys) describes. Without the Chrome Web Store secrets, the Chrome step does nothing, and the version has to be uploaded in the Chrome Web Store developer dashboard.

The Mac App Store version isn’t part of the Release workflow. On a Mac with Xcode, signed in to the developer’s Apple Account, `npm run mac-app -- --upload` builds the Mac app and uploads it to App Store Connect, to submit there, and `--build 2` (and so on) numbers a second upload of the same version. Without `--upload`, it stops at a signed archive in `artifacts/mac/`, with the app in it to try first. App Store Connect’s own Safari Web Extension Packager can’t make the Mac app: It gives the app and its extension bundle IDs that don’t match, so the export fails.

The [Pages workflow](.github/workflows/pages.yml) publishes the website from `site/` whenever it changes. It also checks the stores every hour, so the website’s install steps send people to a store as soon as it lists the extension. And every hour, it rebuilds `data/implementations.json` from the latest [browser-compat-data](https://github.com/mdn/browser-compat-data) release, `data/mdn.json` from [mdn/content](https://github.com/mdn/content), `data/caniuse.json` from the latest [caniuse-db](https://github.com/Fyrd/caniuse) and [web-features](https://github.com/web-platform-dx/web-features) releases, and `data/wpt.json` from [wpt.fyi](https://wpt.fyi/)’s latest aligned stable runs, so the extension’s browser-support, MDN, Can I Use, and test-results data stay current.

## Built on the WebExtensions spec

The extension showcases the use of particular features from the [WebExtensions spec](https://w3c.github.io/webextensions/specification/):

| Feature | Spec | What it does here |
|---|---|---|
| Isolated worlds, `world: "MAIN"` | [§3.1](https://w3c.github.io/webextensions/specification/#isolated-worlds), [§13.2](https://w3c.github.io/webextensions/specification/#content-scripts) | A main-world script waits for live ReSpec drafts to render (`document.respec.ready` exists only in the page’s world) |
| Match patterns, `include_globs`, `run_at` | [§9](https://w3c.github.io/webextensions/specification/#match-patterns), [§10](https://w3c.github.io/webextensions/specification/#globs), [§13.2](https://w3c.github.io/webextensions/specification/#content-scripts) | Scripts run only on spec hosts, and on github.com only for the owners of W3C repos (globs generated from the w3c/groups data) |
| Ignoring unknown manifest keys | [§2.2](https://w3c.github.io/webextensions/specification/#manifest-keys) | One manifest declares a side panel and a sidebar, and each browser ignores the key it doesn’t define |
| The `background` key | [§2.2.9](https://w3c.github.io/webextensions/specification/#key-background) ([PR #1123](https://github.com/w3c/webextensions/pull/1123)) | One script serves as a service worker or an event page |
| The `browser` global | [§5](https://w3c.github.io/webextensions/specification/#the-browser-global) | `browser.*` everywhere, with no polyfill |
| `default_locale` and `_locales` | [§2.2.8](https://w3c.github.io/webextensions/specification/#key-default_locale) | Localizable name and description |
| Alarms | [PR #1110](https://github.com/w3c/webextensions/pull/1110) | Scheduled data refreshes |

## Data sources

[browser-specs](https://github.com/w3c/browser-specs), [w3c/groups](https://github.com/w3c/groups), [webref](https://github.com/w3c/webref), the [W3C API](https://api.w3.org/doc), the [TPAC 2026 calendar](https://www.w3.org/calendar/tpac2026/), [ReSpec’s xref service](https://respec.org/xref/), MDN’s [browser-compat-data](https://github.com/mdn/browser-compat-data) and [content](https://github.com/mdn/content), caniuse’s [caniuse-db](https://github.com/Fyrd/caniuse), with [web-features](https://github.com/web-platform-dx/web-features) mapping its features to specs, and [wpt.fyi](https://wpt.fyi/)’s web-platform-tests results, by way of the website’s `data/implementations.json`, `data/mdn.json`, `data/caniuse.json`, and `data/wpt.json`. The MDN articles’ titles, page types, and spec links come from the front matter of MDN’s pages, and MDN’s content is under [CC-BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/); caniuse’s data, by Alexis Deveria, is under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Snapshots of the spec, group, repository, IDL-name, browser-support, MDN, Can I Use, test-results, and TPAC data ship in `data/`, so the extension works offline.

## Privacy

The extension collects nothing and sends nothing about you anywhere. It reads the address of the page you’re on to look it up, and fetches public data from W3C-run services and GitHub Pages. See [store/privacy.md](store/privacy.md).

## Future work

Some ideas for what comes next:

- **The standards body on the card:** the name and logo of the body each spec comes from, beside the group responsible for it.
- **From MDN to the spec:** on an MDN page, the card for the spec it documents, with the spec’s group and standards body.
- **Definition counts in the specs themselves:** Bikeshed and ReSpec could list the other specs that use each definition right in their own definition panels, from webref’s data ([speced/bikeshed#3155](https://github.com/speced/bikeshed/issues/3155), [speced/respec#5435](https://github.com/speced/respec/issues/5435)). The extension’s counts would then matter only for specs built some other way.
- **Less to maintain:** the link check repeats one of [strudy](https://github.com/w3c/strudy)’s checks, so sharing strudy’s code would leave one copy of it to keep up.

These would each put another part of WebExtensions to work, as the features in [Built on the WebExtensions spec](#built-on-the-webextensions-spec) do:

- **In-page features on more spec sites:** the definition counts, copying steps, and the link check run only on the spec sites the extension lists, and not yet on the IETF’s or TC39’s, though the card knows their specs. Each further site could be one you turn on from the popup: [`optional_host_permissions`](https://w3c.github.io/webextensions/specification/#key-optional_host_permissions) and `permissions.request()` ask for just that site, and `scripting.registerContentScripts()` starts the in-page features there. So the extension reaches only the sites you choose — and a new site never prompts every user at the next update, as new `host_permissions` would (Chrome disables the extension until they’re accepted).
- **Specs in DevTools:** a DevTools pane with the specs that define the element you inspect, its attributes, its CSS properties, and its interfaces, from webref’s data. The [`devtools_page`](https://w3c.github.io/webextensions/specification/#key-devtools_page) manifest key would add it beside the Elements panel’s own panes in Chrome and Firefox, and as a panel of its own in Safari.
- **Editor’s drafts first:** an opt-in setting that opens a spec’s editor’s draft whenever you follow a link to its TR version, with `declarativeNetRequest` redirect rules made from browser-specs’ data.
- **Side by side:** a spec’s TR version beside its editor’s draft, or a spec beside the issue you’re filing against it, in one split view, with the [proposed](https://github.com/w3c/webextensions/blob/main/proposals/split-view-modification.md) `splitWithTabId` option of `tabs.create()`, for the split views of Chrome and Firefox.
- **User scripts for spec pages:** small scripts that people write to change or add to spec pages, each one turned on separately and run in a user-script world of its own, apart from the page and from the others, with the `userScripts` API of Chrome and Firefox — a way to try out an idea on spec pages before any spec tool takes it up.
- **One test suite in every browser:** the extension’s end-to-end tests run in Chrome, Firefox, and Safari alike, installing it with WebDriver BiDi’s [`webExtension.install`](https://w3c.github.io/webdriver-bidi/#command-webExtension-install) (as `npm run e2e:firefox` does in Firefox) or the WebExtensions group’s [WebDriver Classic commands](https://w3c.github.io/webextensions/specification/webdriver-classic.html), and checking it with the [proposed](https://github.com/w3c/webextensions/blob/main/proposals/browser_test_api.md) `browser.test` API.
- **Focus where the side panel points:** when the side panel shows you a broken link or a review comment in the page, keyboard focus moving to it in the page, with the proposed `tabs.focus()` ([w3c/webextensions#817](https://github.com/w3c/webextensions/pull/817)).
- **No main-world script:** waiting for a live ReSpec draft to render from the isolated world itself, with the proposed `dom.execute()` and `dom.createPort()` ([w3c/webextensions#678](https://github.com/w3c/webextensions/pull/678), [w3c/webextensions#679](https://github.com/w3c/webextensions/pull/679)), in place of a main-world script whose signal the page could also send.
- **In your language:** the extension’s text in more languages than English, in a language you pick for it alone, apart from the browser’s, with `_locales`, the `i18n` API, and the proposed per-extension language preference ([w3c/webextensions#641](https://github.com/w3c/webextensions/pull/641)).

## Contributing

Contributions are welcome: Open an issue or a pull request in this repository.

## Acknowledgements

- The card is built mostly on [browser-specs](https://github.com/w3c/browser-specs) and [webref](https://github.com/w3c/webref), which W3C’s François Daoust and Dominique Hazaël-Massieux created and maintain.
- The “Reviewing a spec” feature was inspired by Martin Thomson’s [Spec Comment browser extension](https://github.com/martinthomson/spec-comment). A review’s Markdown takes the shape of Mark Nottingham’s [ietf-comments format](https://github.com/mnot/ietf-comments/blob/main/format.md), as Spec Comment’s does.
- The “Copying steps” feature was inspired by a [“spec copy button” userscript](https://bsky.app/profile/lukewarlow.dev/post/3luzxwrdaf22y) that Luke Warlow made, and by noticing how ecmarkup’s [listNumbers.js](https://github.com/tc39/ecmarkup/blob/main/js/listNumbers.js) causes step numbers to be included in text copied out from algorithms in the EcmaScript spec and in TC39 proposals.

## License

[Apache-2.0](LICENSE). `npm run icons` renders the icons in `static/icons/`, and the Firefox Add-ons icon, the App Store icons, and the promo tile in `store/`, from the avatar in `assets/` (and for the App Store icons, the SVG traced from it), and needs [ImageMagick](https://imagemagick.org/). The browser logos in `static/icons/browsers/` are from [alrra/browser-logos](https://github.com/alrra/browser-logos/tree/58881b84c4d73adc03c06fa2c275a7abee02d935/src), under the MIT license in `LICENSE.txt` beside them. The logos themselves are trademarks of Mozilla, Apple, and Google. The MDN mark in `src/ui/components/Mdn.tsx` is the path from [Simple Icons](https://simpleicons.org/)’ MDN Web Docs icon, which is CC0 1.0. MDN Web Docs and its mark are Mozilla’s trademarks. The Can I Use logo in `static/icons/caniuse.png` is caniuse.com’s icon, by Alexis Deveria, used with attribution until it’s released under a free license; this repository’s license doesn’t cover it. The wpt.fyi logo in `static/icons/wpt.svg` is from [wpt.fyi](https://github.com/web-platform-tests/wpt.fyi), under the W3C 3-clause BSD license in `wpt-LICENSE.txt` beside it.
