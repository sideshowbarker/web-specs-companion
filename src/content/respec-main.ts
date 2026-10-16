// Runs in the page's main world: document.respec exists only there, not in the isolated world that the extension's
// spec.js content script runs in. And only a string crosses back, since objects passed between worlds can leak.
// https://w3c.github.io/webextensions/specification/#isolated-worlds
const READY = 'w3c-companion:respec-ready';
const respec = (document as Document & { respec?: { ready?: Promise<unknown> } }).respec;
const signal = () => window.postMessage(READY, location.origin);
if (respec?.ready) respec.ready.then(signal, signal);

export {};
