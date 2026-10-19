# Manual checklist before each submission

Run steps 1–17 in Chrome (latest stable) and Firefox (latest release) with a fresh profile, and step 18 in Safari.

1. Install `artifacts/web-specs-companion-<version>.zip` (Chrome: drag onto chrome://extensions; Firefox: about:debugging → Load Temporary Add-on). No errors, and warnings only for the other browser’s keys: Firefox shows exactly two, for the Chrome-only sidePanel permission and side_panel key; Chrome warns only about Firefox keys, such as sidebar_action.
2. https://w3c.github.io/webappsec-fetch-metadata/ — badge “ED”; popup card with group, chairs, footprint; definition counts in the page; the link check runs and reports a result.
3. https://www.w3.org/TR/fetch-metadata/ — badge “WD”; the radar says “Latest TR version.”
4. https://www.w3.org/TR/2023/REC-wai-aria-1.2-20230606/ — the radar points at the latest TR and a newer level.
5. https://w3c.github.io/aria/ — counts appear after ReSpec renders; the card notes the other level.
6. https://html.spec.whatwg.org/ — the page stays responsive while counts appear.
7. https://github.com/w3c/aria, then navigate within GitHub to https://github.com/w3c/csswg-drafts — the popup follows.
8. https://www.w3.org/groups/wg/css/ — the CSS WG card with its specs.
9. Address bar: `spec fetch`, `spec wg css`, `spec Request`, `spec dfn navigate`.
10. “Keep this open beside the page” opens the side panel (Chrome) or sidebar (Firefox) and follows tab switches.
11. Keyboard only: every control reachable, visible focus ring; Escape closes the definition popover.
12. Offline (network off, extension reloaded): the card still resolves; the footer warns about live data.
13. `npm run lint:firefox` reports no errors.
14. https://fetch.spec.whatwg.org/ — the card shows all three browser logos in color, and a green check mark. https://wicg.github.io/webusb/ — only the Chrome logo is in color, there’s no check mark, and “What’s missing?” opens a list of what Firefox and Safari lack. The footer lists “Browser support”. With the network off, as in step 12, the logos still show. And the row reads well in both light and dark mode.
15. https://fetch.spec.whatwg.org/ — the MDN button at the right end of the browser-logo row shows MDN’s mark and the number of articles, and opens a list that starts “Overview: Fetch API”; Request’s toggle shows its members, and opening “What’s missing?” on a card that has it closes the MDN list. https://w3c.github.io/aria/ — the list has ARIA roles and ARIA attributes sections. https://w3c.github.io/html-aria/ — the row shows only the MDN button. https://html.spec.whatwg.org/multipage/ — typing “dialog” in the list’s filter box narrows it to the dialog pages. And the button and the list read well in both light and dark mode.
16. https://fetch.spec.whatwg.org/ — the Can I Use button, after the MDN button, shows caniuse’s logo and 2, and opens a list of Cross-Origin Resource Sharing and Fetch; Fetch’s chips read 39+, 10.1+, and 42+, and its bars’ labels say since when. https://w3c.github.io/battery/ — Firefox’s label reads “No · removed in 52”. https://html.spec.whatwg.org/multipage/ — typing “dialog” in the filter narrows the list to the dialog element. Opening any of the row’s four panels closes the others, and the bars and chips read well in both light and dark mode.
17. https://fetch.spec.whatwg.org/ — the wpt.fyi button, after the Can I Use button, shows wpt.fyi’s logo and the interop score, and opens a table with All tests, cors/, and fetch/ rows; the fetch/ link opens wpt.fyi on the same three runs and the same test count as its row, and Safari’s fails-only link on as many tests as its count. https://html.spec.whatwg.org/multipage/ — the table has 12 directory rows. https://w3c.github.io/battery/ — the table has just All tests, and no “Fail in only one browser” line. Opening any of the row’s four panels closes the others, and the table’s tints read well in both light and dark mode.
18. Safari (latest release): Settings → Developer → Add Temporary Extension…, and select the zip. It installs with no errors; once allowed on the site, steps 2, 3, 7, 8, 14, 15, 16, and 17 work as in Chrome; the panel has no “Keep this open beside the page” button, and the address bar has no `spec` keyword. Removing the extension and adding it again works.
