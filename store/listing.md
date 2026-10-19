# Store listing — Web Specs Companion 1.1.0

**Name:** Web Specs Companion

**Summary (132 characters max):**
A companion for reading web specs and finding the groups and people behind them.

**Description:**
Web Specs Companion shows all that’s known about the page you’re on.

On a spec from W3C, WHATWG, TC39, the IETF, Khronos, or elsewhere, it shows what’s known of the spec’s maturity, versions, repository and issue tracker, tests, and the group responsible for it. For a W3C spec, that includes the editor’s draft and TR versions, and the group’s chairs, team contacts, and charter end date.

It tells you when you’re reading a dated snapshot or an old level, and sums up the spec’s place in the web platform. And in W3C and WHATWG specs, it also shows how many other specs use each definition, and checks the spec’s links to other specs for anchors that no longer exist.

A row of buttons on the card says which browser engines implement the spec, and opens its MDN articles, its Can I Use features, and its web-platform-tests results on wpt.fyi.

On a W3C repository on GitHub, it shows the group behind the repository and the specs it hosts. On a w3.org group page, it shows the group’s specs.

Type “spec” and a space in the address bar to search specs, groups, Web IDL names, and terms.

During TPAC 2026 (Dublin, 26–30 October), it shows what’s in session now and next, and when each group meets.

Data comes from public sources: browser-specs, w3c/groups, webref, the W3C API, MDN’s browser-compat-data and articles, Can I Use, wpt.fyi, and the TPAC calendar.

Web Specs Companion is a personal project. It isn’t affiliated with or endorsed by W3C.

**Screenshots (1280×800):** All ten in screenshots/ go to Firefox Add-ons: card-editors-draft.png, used-by-counts.png, version-radar.png, mdn-articles.png, caniuse-features.png, wpt-results.png, github-repo.png, group-page.png, side-panel.png, tpac-now-and-next.png.

**Chrome Web Store screenshots (at most five):** card-editors-draft.png, version-radar.png, caniuse-features.png, side-panel.png, tpac-now-and-next.png.

**Store icon (128×128):** static/icons/128.png.

**Small promo tile (440×280, Chrome):** store/promo-tile-440x280.png.

**Privacy policy URL:** https://github.com/sideshowbarker/web-specs-companion/blob/main/store/privacy.md

**Homepage and support:** https://github.com/sideshowbarker/web-specs-companion and https://github.com/sideshowbarker/web-specs-companion/issues

**Category:** Developer Tools (Chrome) / Web Development (Firefox)

**Single purpose (Chrome):** Help people reading web specs find the spec’s versions, group, and related specs.

**Permission justifications (Chrome):**
- storage: remembers the panel setting and caches public W3C data.
- alarms: refreshes the cached data every few hours.
- activeTab: reads the address of the current tab when the user opens the popup.
- sidePanel: offers the same panel beside the page.
- Host permissions: the listed W3C and WHATWG spec sites and github.com, to recognize spec pages and W3C repositories
  and show definitions’ usage in the page; api.w3.org, www.w3.org, and w3c.github.io to fetch public W3C data.
- Remote code: none. The extension fetches JSON data only.

**Data usage (Chrome) / data collection (Firefox):** No user data is collected or transmitted.
