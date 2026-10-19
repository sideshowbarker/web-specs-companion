# Web Specs Companion

A browser extension for reading web specs and finding the groups and people behind them. Wherever you are — a spec, a W3C GitHub repo, a w3.org group page — it shows a detailed “cheatsheet” of info for all that’s known about it:

- **The card:** the spec’s maturity, its editor’s draft and TR versions, its repository and issues, its tests, and the group responsible for it — with the group’s chairs, team contacts, and charter end date.
- **The version radar:** whether you’re reading a dated snapshot, whether a newer level exists, and how far the latest TR version lags the draft.
- **Browser support:** which browser engines implement the spec, and buttons for its [MDN](https://developer.mozilla.org/) articles, its [Can I Use](https://caniuse.com/) features, and its web-platform-tests results on [wpt.fyi](https://wpt.fyi/).
- **Spec intelligence from [webref](https://github.com/w3c/webref):** how many other specs use each definition (what [specdex](https://dontcallmedom.github.io/specdex/) shows, in the page you’re reading), the spec’s platform footprint, and a check of its links to other specs for anchors that no longer exist (one of [strudy](https://github.com/w3c/strudy)’s checks, run live).
- **Search:** type `spec` and a space in the address bar to search specs, groups, Web IDL names ([webidlpedia](https://dontcallmedom.github.io/webidlpedia/)), and terms (ReSpec’s xref service).
- **TPAC 2026:** what’s in session now and next, and when each group meets.

Web Specs Companion is a personal project. It isn’t affiliated with or endorsed by W3C.

## Screenshots

![The card for an editor’s draft: its maturity, its links, its group and chairs, and its platform footprint](screenshots/card-editors-draft.png)

![The Fetch standard with a count beside each definition, and the list of specs that use “fetch”](screenshots/used-by-counts.png)

![The version radar on a dated snapshot of WAI-ARIA 1.2, pointing at the latest TR version and a newer level](screenshots/version-radar.png)

More: [the MDN articles](screenshots/mdn-articles.png), [the Can I Use features](screenshots/caniuse-features.png), and [the wpt.fyi results](screenshots/wpt-results.png) for CSS Anchor Positioning, [a W3C repo on GitHub](screenshots/github-repo.png), [a w3.org group page](screenshots/group-page.png), [the side panel beside a live ReSpec draft](screenshots/side-panel.png), and [TPAC Now and Next on breakout day](screenshots/tpac-now-and-next.png).

## Install

The [Web Specs Companion website](https://sideshowbarker.net/web-specs-companion/) has these steps too, with the steps for your browser first.

Web Specs Companion isn’t in the Chrome Web Store or on Firefox Add-ons yet. Until it is, install it from the [latest release](https://github.com/sideshowbarker/web-specs-companion/releases/latest). It needs Chrome or Edge 148 or later, Firefox 128 or later, or Safari 26 or later.

### Chrome, Edge, and other Chromium-based browsers

1. Download `web-specs-companion-<version>.zip` from the latest release, and unzip it into a folder it can stay in — the browser loads the extension from that folder every time it starts.
2. Open `chrome://extensions` (`edge://extensions` in Edge, `brave://extensions` in Brave).
3. Turn on **Developer mode**.
4. Click **Load unpacked**, and select the unzipped folder.

To update it, unzip a newer release into the same folder, and click the reload button on the extension’s card.

### Firefox

1. In Firefox, click `web-specs-companion-<version>.xpi` in the latest release, and allow the installation when Firefox asks.
2. Or download the `.xpi`, open `about:addons`, click the gear button, choose **Install Add-on From File…**, and select it.

The `.xpi` is the file Firefox Add-ons signed and serves for that version, so it stays installed after Firefox restarts, and Firefox keeps it up to date from Firefox Add-ons.

### Safari

Safari 26 or later can run Web Specs Companion as a temporary extension, from the same zip as Chrome. Safari removes a temporary extension when it quits, and after 24 hours, so add it again whenever it’s gone. Safari has no address-bar keywords or side panels for extensions, so the `spec` keyword and **Keep this open beside the page** aren’t there.

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

## Contributing

Contributions are welcome: Open an issue or a pull request in this repository.

## License

[Apache-2.0](LICENSE). `npm run icons` renders the icons in `static/icons/`, and the Firefox Add-ons icon and the promo tile in `store/`, from the avatar in `assets/`, and needs [ImageMagick](https://imagemagick.org/). The browser logos in `static/icons/browsers/` are from [alrra/browser-logos](https://github.com/alrra/browser-logos/tree/58881b84c4d73adc03c06fa2c275a7abee02d935/src), under the MIT license in `LICENSE.txt` beside them. The logos themselves are trademarks of Mozilla, Apple, and Google. The MDN mark in `src/ui/components/Mdn.tsx` is the path from [Simple Icons](https://simpleicons.org/)’ MDN Web Docs icon, which is CC0 1.0. MDN Web Docs and its mark are Mozilla’s trademarks. The Can I Use logo in `static/icons/caniuse.png` is caniuse.com’s icon, by Alexis Deveria, used with attribution until it’s released under a free license; this repository’s license doesn’t cover it. The wpt.fyi logo in `static/icons/wpt.svg` is from [wpt.fyi](https://github.com/web-platform-tests/wpt.fyi), under the W3C 3-clause BSD license in `wpt-LICENSE.txt` beside it.
