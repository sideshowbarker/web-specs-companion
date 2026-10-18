// Puts the install steps for the visitor's browser first, and points the install button at the top of the page at them
// (or straight at the store, once a store lists the extension). Without this script, the page lists every browser.
(() => {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    document.getElementById('mobile-note').hidden = false;
    return;
  }
  const id = /Firefox\//.test(ua) ? 'firefox' : /Chrome\/|Chromium\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : '';
  const section = id && document.getElementById(id);
  if (!section) return;
  const name = { firefox: 'Firefox', safari: 'Safari' }[id] ?? (/Edg\//.test(ua) ? 'Edge' : 'brave' in navigator ? 'Brave' : 'Chrome');
  section.parentElement.prepend(section);
  section.classList.add('yours');
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = 'Your browser';
  section.querySelector('h3').append(tag);
  const button = document.getElementById('install-button');
  button.textContent = `Install in ${name}`;
  button.href = section.querySelector('a.store')?.href ?? `#${id}`;
})();
