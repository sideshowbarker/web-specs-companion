// The browser global is the extension-API namespace:
// https://w3c.github.io/webextensions/specification/#the-browser-global
// Chromium builds older than 148 expose only chrome; alias it so the rest of the code uses browser.* everywhere.
const g = globalThis as { browser?: typeof chrome; chrome?: typeof chrome };
g.browser ??= g.chrome;

declare global {
  // eslint-disable-next-line no-var
  var browser: typeof chrome;
}

export {};
