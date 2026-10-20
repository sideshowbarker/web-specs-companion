# App Store listing — Web Specs Companion for Mac

The Mac app that npm run mac-app builds and uploads, as the README’s Releasing section says. It differs from the other stores’ listing (listing.md) in what Safari lacks: There’s no side panel and no address-bar keyword, so the description mentions neither.

App Store Connect spreads the listing over several pages. Each section below is one of them, in the order of the app’s sidebar, and has the fields in the order the page shows them.

## macOS App Version 1.1.0

The version under macOS App, at the top of the sidebar, while it’s in Prepare for Submission.

**App Previews:** None. They’re optional videos, and the screenshots already show all that the app does.

**Screenshots (16:10, 1 to 10):** These five, at 2880×1800 and taken in Safari, in this order: store/app-store-screenshots/card-editors-draft.png, version-radar.png, used-by-counts.png, caniuse-features.png, github-repo.png.

**Promotional text (170 characters max):**
During TPAC 2026 (Dublin, 26–30 October), it shows what’s in session now and next, and when each group meets.

App Store Connect lets the promotional text change at any time, while the description changes only with a new version. So TPAC goes here, and comes out once TPAC is over.

**Description (4,000 characters max):**
Web Specs Companion shows all that’s known about the page you’re on.

On any web spec, it shows what’s known of the spec’s maturity, versions, repository and issue tracker, tests, and the group responsible for it. For a W3C spec, that includes the editor’s draft and TR versions, and the group’s chairs, team contacts, and charter end date.

It tells you when you’re reading a dated snapshot or an old level, and sums up the spec’s place in the web platform. And in W3C and WHATWG specs, it also shows how many other specs use each definition, and checks the spec’s links to other specs for anchors that no longer exist.

A row of buttons on the card says which browser engines implement the spec, and opens its MDN articles, its Can I Use features, and its web-platform-tests results on wpt.fyi.

On a W3C repository on GitHub, it shows the group behind the repository and the specs it hosts. On a w3.org group page, it shows the group’s specs.

After you install it, turn it on in Safari’s Settings, under Extensions, and allow it on the spec sites you read.

Data comes from public sources, including browser-specs, webref, MDN, Can I Use, and wpt.fyi.

Web Specs Companion is a personal project. It isn’t affiliated with or endorsed by W3C.

**Keywords (100 characters max):**
specification,standards,web platform,Web IDL,browser support,developer,reference,interop,tests,spec

Apple already indexes the words in the app’s name, so the keywords don’t repeat them. And guideline 2.3.7 rules out trademarked terms, so there are no organization or product names.

**Support URL:** https://github.com/sideshowbarker/web-specs-companion/issues

**Marketing URL:** https://sideshowbarker.net/web-specs-companion/

**Version:** 1.1.0, to match the build, which takes its version from the manifest.

**Copyright:** 2026 and the developer’s legal name.

**Build:** The one that npm run mac-app -- --upload sends. It shows up here once App Store Connect has processed it.

**App Review Information:** Sign-in required stays unchecked, and the contact information is the developer’s name, phone number, and email. The notes: No sign-in needed. Turn the extension on in Safari’s Settings → Extensions, open https://www.w3.org/TR/css-anchor-position-1/, and click the extension’s button in the toolbar.

**App Sandbox Information:** None. It’s optional.

**App Store Version Release:** Automatically release this version, so it’s out as soon as App Review approves it.

## App Information

Under General.

**Name (30 characters max):** Web Specs Companion

**Subtitle (30 characters max):** For reading web specs

**Bundle ID:** net.sideshowbarker.WebSpecsCompanion

**Category:** Developer Tools, and Reference as the secondary category.

**Content Rights:** Yes, it shows third-party content, and yes, it has the rights to it: All that it shows comes from public sources that publish their data for reuse.

**Age Rating:** None for every question in the questionnaire, for 4+. Guideline 2.3.8 also asks that the icon and screenshots suit 4+, and the avatar in the icon has a cigarette, so App Review may ask for another icon.

## App Privacy

Under Trust & Safety.

**Privacy Policy URL:** https://sideshowbarker.net/web-specs-companion/privacy/

**Data collection:** No: The app collects no data, as privacy.md says, so its product page shows Data Not Collected.

## Pricing and Availability

Under Monetization.

**Price:** Free, in every country and region.

## Not on any page

**App icon:** App Store Connect takes a Mac app’s icon from the build, and Safari’s packager, in npm run mac-app, makes it from the manifest’s largest icon, static/icons/1024.png. store/app-icon-1024.png is the avatar on Apple’s macOS icon grid, for an icon set made by hand instead.
