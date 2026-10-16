# Manual checklist before each submission

Run steps 1–13 in Chrome (latest stable) and Firefox (latest release) with a fresh profile, and step 14 in Safari.

1. Install `artifacts/w3c-companion-<version>.zip` (Chrome: drag onto chrome://extensions; Firefox: about:debugging → Load Temporary Add-on). No errors, and warnings only for the other browser’s keys: Firefox shows exactly two, for the Chrome-only sidePanel permission and side_panel key; Chrome warns only about Firefox keys, such as sidebar_action.
2. https://w3c.github.io/webappsec-fetch-metadata/ — badge “ED”; popup card with group, chairs, footprint; definition counts in the page; the link check runs and reports a result.
3. https://www.w3.org/TR/fetch-metadata/ — badge “WD”; the radar says “Latest TR version.”
4. https://www.w3.org/TR/2023/REC-wai-aria-1.2-20230606/ — the radar points at the latest TR and a newer level.
5. https://w3c.github.io/aria/ — counts appear after ReSpec renders; the card notes the other level.
6. https://html.spec.whatwg.org/ — the page stays responsive while counts appear.
7. https://github.com/w3c/aria, then navigate within GitHub to https://github.com/w3c/csswg-drafts — the popup follows.
8. https://www.w3.org/groups/wg/css/ — the CSS WG card with its specs.
9. Address bar: `w3c fetch`, `w3c wg css`, `w3c Request`, `w3c dfn navigate`.
10. “Keep this open beside the page” opens the side panel (Chrome) or sidebar (Firefox) and follows tab switches.
11. Keyboard only: every control reachable, visible focus ring; Escape closes the definition popover.
12. Offline (network off, extension reloaded): the card still resolves; the footer warns about live data.
13. `npm run lint:firefox` reports no errors.
14. Safari (latest release): Settings → Developer → Add Temporary Extension…, and select the zip. It installs with no errors; once allowed on the site, steps 2, 3, 7, and 8 work as in Chrome; the panel has no “Keep this open beside the page” button, and the address bar has no `w3c` keyword. Removing the extension and adding it again works.
