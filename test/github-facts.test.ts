// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readGitHubFacts, watchNavigation } from '../src/content/github-facts.ts';

afterEach(() => vi.useRealTimers());

describe('readGitHubFacts', () => {
  it("reads the canonical repo name and route from GitHub's meta tags", () => {
    document.head.innerHTML = `
      <meta name="octolytics-dimension-repository_nwo" content="w3c/aria">
      <meta name="route-pattern" content="/:user_id/:repository/issues/:id(.:format)">`;
    expect(readGitHubFacts(document, 'https://github.com/W3C/ARIA/issues/5')).toEqual({
      kind: 'github',
      url: 'https://github.com/W3C/ARIA/issues/5',
      github: { nwo: 'w3c/aria', route: '/:user_id/:repository/issues/:id(.:format)', number: 5 },
    });
  });

  it('falls back to the URL when the meta tags are missing', () => {
    document.head.innerHTML = '';
    expect(readGitHubFacts(document, 'https://github.com/w3c/csswg-drafts').github).toEqual({ nwo: 'w3c/csswg-drafts', route: undefined, number: undefined });
  });
});

describe('watchNavigation', () => {
  it("reports a soft navigation once, after GitHub's render event", async () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/w3c/aria');
    const seen: string[] = [];
    const stop = watchNavigation(window, document, (u) => seen.push(new URL(u).pathname), 1_000);
    history.pushState(null, '', '/w3c/csswg-drafts');
    document.dispatchEvent(new Event('turbo:render'));
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(seen).toEqual(['/w3c/csswg-drafts']);
    stop();
  });

  it('notices a URL change even without any event, by polling', async () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/w3c/aria');
    const seen: string[] = [];
    const stop = watchNavigation(window, document, (u) => seen.push(new URL(u).pathname), 1_000);
    history.pushState(null, '', '/w3c/webref');
    await vi.advanceTimersByTimeAsync(1_500);
    expect(seen).toEqual(['/w3c/webref']);
    stop();
  });
});
