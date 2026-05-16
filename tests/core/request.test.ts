import { describe, it, expect, vi } from 'vitest';
import { buildUrl, request } from '../../src/core/request.js';
import {
  APIError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
  KeepaError,
} from '../../src/core/error.js';

describe('buildUrl', () => {
  const base = 'https://api.keepa.com';

  it('returns base+path when no query is provided', () => {
    expect(buildUrl(base, '/product')).toBe('https://api.keepa.com/product');
  });

  it('appends a single string param', () => {
    expect(buildUrl(base, '/product', { key: 'abc' })).toBe(
      'https://api.keepa.com/product?key=abc',
    );
  });

  it('joins multiple params with &', () => {
    expect(buildUrl(base, '/product', { key: 'abc', domain: 1 })).toBe(
      'https://api.keepa.com/product?key=abc&domain=1',
    );
  });

  it('joins arrays with literal commas (does NOT encode , as %2C)', () => {
    const url = buildUrl(base, '/product', { asin: ['B001', 'B002', 'B003'] });
    expect(url).toBe('https://api.keepa.com/product?asin=B001,B002,B003');
  });

  it('skips params whose value is undefined', () => {
    const url = buildUrl(base, '/product', { key: 'abc', extra: undefined });
    expect(url).toBe('https://api.keepa.com/product?key=abc');
  });

  it('encodes special characters in values, keeping commas literal', () => {
    const url = buildUrl(base, '/search', { term: 'hello world & stuff' });
    expect(url).toBe('https://api.keepa.com/search?term=hello%20world%20%26%20stuff');
  });
});

describe('request', () => {
  const base = { baseURL: 'https://api.keepa.com', apiKey: 'test-key' };

  it('injects apiKey as ?key= and returns parsed JSON on 200', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products: [{ asin: 'B001' }] }), { status: 200 }),
    );
    const result = await request<{ products: Array<{ asin: string }> }>(
      { ...base, fetch: fakeFetch },
      { path: '/product', query: { domain: 1, asin: ['B001'] }, context: 'product API' },
    );
    expect(result).toEqual({ products: [{ asin: 'B001' }] });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const calledUrl = fakeFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toBe(
      'https://api.keepa.com/product?key=test-key&domain=1&asin=B001',
    );
  });

  it('throws RateLimitError on 429', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('too many', { status: 429 }));
    await expect(
      request({ ...base, fetch: fakeFetch }, { path: '/product', context: 'product API' }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws AuthenticationError on 401', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('bad key', { status: 401 }));
    await expect(
      request({ ...base, fetch: fakeFetch }, { path: '/product', context: 'product API' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws generic APIError on 500 with status preserved', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('server boom', { status: 500 }));
    try {
      await request(
        { ...base, fetch: fakeFetch },
        { path: '/product', context: 'product API' },
      );
      throw new Error('expected request to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(500);
      expect((err as APIError).body).toBe('server boom');
    }
  });

  it('wraps a fetch transport failure (DNS/ECONNREFUSED/abort) in NetworkError', async () => {
    const cause = new TypeError('fetch failed');
    const fakeFetch = vi.fn().mockRejectedValue(cause);
    try {
      await request(
        { ...base, fetch: fakeFetch },
        { path: '/product', context: 'product API' },
      );
      throw new Error('expected request to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkError);
      expect(err).toBeInstanceOf(KeepaError);
      expect((err as NetworkError).cause).toBe(cause);
      expect((err as NetworkError).context).toBe('product API');
    }
  });

  it('does NOT leak the API key into APIError.message or .body on a server error', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response('upstream said: ?key=test-key&domain=1', { status: 500 }),
    );
    try {
      await request(
        { ...base, fetch: fakeFetch },
        { path: '/product', context: 'product API' },
      );
      throw new Error('expected to throw');
    } catch (err) {
      const e = err as APIError;
      expect(e.message).not.toContain('test-key');
      expect(e.body).not.toContain('test-key');
      expect(e.message).toMatch(/REDACTED/);
    }
  });

  it('does NOT leak the API key when a fetch failure message echoes the URL', async () => {
    const cause = new TypeError('fetch failed: GET https://api.keepa.com/product?key=test-key&domain=1');
    const fakeFetch = vi.fn().mockRejectedValue(cause);
    try {
      await request(
        { ...base, fetch: fakeFetch },
        { path: '/product', context: 'product API' },
      );
      throw new Error('expected to throw');
    } catch (err) {
      expect((err as NetworkError).message).not.toContain('test-key');
      expect((err as NetworkError).message).toMatch(/REDACTED/);
    }
  });

  it('fires onRateLimit with the bucket snapshot on a 200 response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ tokensLeft: 240, refillIn: 12_345, refillRate: 60, products: [] }),
        { status: 200 },
      ),
    );
    const onRateLimit = vi.fn();
    await request(
      { ...base, fetch: fakeFetch, onRateLimit },
      { path: '/product', context: 'product API' },
    );
    expect(onRateLimit).toHaveBeenCalledOnce();
    const snapshot = onRateLimit.mock.calls[0]![0];
    expect(snapshot.tokensLeft).toBe(240);
    expect(snapshot.refillIn).toBe(12_345);
    expect(snapshot.refillRate).toBe(60);
  });

  it('fires onRateLimit on a 429 and attaches the snapshot to RateLimitError', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ tokensLeft: 0, refillIn: 5_000, refillRate: 60, error: 'rate limited' }),
        { status: 429 },
      ),
    );
    const onRateLimit = vi.fn();
    try {
      await request(
        { ...base, fetch: fakeFetch, onRateLimit },
        { path: '/product', context: 'product API' },
      );
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).rateLimit?.tokensLeft).toBe(0);
      expect((err as RateLimitError).rateLimit?.refillIn).toBe(5_000);
      expect(onRateLimit).toHaveBeenCalledOnce();
    }
  });

  it('does not fire onRateLimit when the response body lacks Keepa bucket fields', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ products: [] }), { status: 200 }),
    );
    const onRateLimit = vi.fn();
    await request(
      { ...base, fetch: fakeFetch, onRateLimit },
      { path: '/product', context: 'product API' },
    );
    expect(onRateLimit).not.toHaveBeenCalled();
  });
});
