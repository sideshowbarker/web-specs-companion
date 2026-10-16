// Firefox-only APIs the extension feature-detects before use.
declare namespace chrome.sidebarAction {
  function open(): Promise<void>;
}
declare namespace chrome.runtime {
  function getBrowserInfo(): Promise<{ name: string; version: string }>;
}
