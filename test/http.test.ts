import { describe, it, expect, vi } from 'vitest';
import { createHttp, MemoryStore, HttpError } from '../src/data/http.ts';

function fakeFetch(responses: Array<{ status: number; body?: string } | Error>) {
  const queue = [...responses];
  return vi.fn(async () => {
    const r = queue.shift();
    if (!r) throw new Error('unexpected fetch');
    if (r instanceof Error) throw r;
    return new Response(r.body ?? '', { status: r.status });
  });
}

describe('createHttp', () => {
  it('fetches, caches, and serves from cache within the TTL', async () => {
    let t = 1_000;
    const f = fakeFetch([{ status: 200, body: '{"a":1}' }]);
    const http = createHttp(new MemoryStore(), f, () => t);
    expect(await http.json('https://x.test/a', { ttlMs: 100 })).toEqual({ a: 1 });
    t += 50;
    expect(await http.json('https://x.test/a', { ttlMs: 100 })).toEqual({ a: 1 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL and falls back to the stale copy when that fails', async () => {
    let t = 0;
    const f = fakeFetch([{ status: 200, body: 'one' }, new TypeError('offline')]);
    const http = createHttp(new MemoryStore(), f, () => t);
    expect(await http.text('https://x.test/b', { ttlMs: 10 })).toBe('one');
    t = 100;
    expect(await http.text('https://x.test/b', { ttlMs: 10 })).toBe('one');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('caches 404s as undefined', async () => {
    const f = fakeFetch([{ status: 404 }]);
    const http = createHttp(new MemoryStore(), f, () => 0);
    expect(await http.json('https://x.test/missing', { ttlMs: 10 })).toBeUndefined();
    expect(await http.json('https://x.test/missing', { ttlMs: 10 })).toBeUndefined();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('throws HttpError on a server error with nothing cached', async () => {
    const http = createHttp(new MemoryStore(), fakeFetch([{ status: 503 }]), () => 0);
    await expect(http.text('https://x.test/c', { ttlMs: 10 })).rejects.toBeInstanceOf(HttpError);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const f = fakeFetch([{ status: 200, body: 'x' }]);
    const http = createHttp(new MemoryStore(), f, () => 0);
    const [a, b] = await Promise.all([http.text('https://x.test/d', { ttlMs: 10 }), http.text('https://x.test/d', { ttlMs: 10 })]);
    expect([a, b]).toEqual(['x', 'x']);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('uses opts.key as the cache key (for POST bodies)', async () => {
    const f = fakeFetch([{ status: 200, body: '1' }, { status: 200, body: '2' }]);
    const http = createHttp(new MemoryStore(), f, () => 0);
    expect(await http.text('https://x.test/post', { ttlMs: 10, key: 'q1' })).toBe('1');
    expect(await http.text('https://x.test/post', { ttlMs: 10, key: 'q2' })).toBe('2');
    expect(await http.text('https://x.test/post', { ttlMs: 10, key: 'q1' })).toBe('1');
  });

  it('still fetches when the cache store fails', async () => {
    const broken = { get: async () => { throw new Error('quota'); }, put: async () => { throw new Error('quota'); } };
    const http = createHttp(broken, fakeFetch([{ status: 200, body: 'ok' }]), () => 0);
    expect(await http.text('https://x.test/e', { ttlMs: 10 })).toBe('ok');
  });

  it('backs off for a minute after a failed fetch, including 429 and 5xx', async () => {
    let t = 0;
    const f = fakeFetch([{ status: 429 }, { status: 200, body: 'back' }]);
    const http = createHttp(new MemoryStore(), f, () => t);
    await expect(http.text('https://x.test/f', { ttlMs: 10 })).rejects.toThrow();
    t = 30_000;
    await expect(http.text('https://x.test/f', { ttlMs: 10 })).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
    t = 61_000;
    expect(await http.text('https://x.test/f', { ttlMs: 10 })).toBe('back');
  });

  it('gives up on a fetch that hangs', async () => {
    const hang = vi.fn((_u: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    }));
    const http = createHttp(new MemoryStore(), hang, () => 0);
    await expect(http.text('https://x.test/g', { ttlMs: 10, timeoutMs: 20 })).rejects.toThrow();
  });
});
