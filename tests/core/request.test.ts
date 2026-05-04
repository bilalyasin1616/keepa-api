import { describe, it, expect, vi } from 'vitest';
import { buildUrl, request } from '../../src/core/request.js';
import { APIError, RateLimitError, AuthenticationError } from '../../src/core/error.js';

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
});
