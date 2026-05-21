import { describe, it, expect, vi } from 'vitest';
import { KeepaClient } from '../../src/client.js';
import { Categories } from '../../src/resources/categories/categories.js';
import {
  APIError,
  AuthenticationError,
  RateLimitError,
} from '../../src/core/error.js';
import type { Marketplace } from '../../src/lib/marketplace.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeClient(fetchImpl: typeof globalThis.fetch): KeepaClient {
  return new KeepaClient({ apiKey: 'test-key', fetch: fetchImpl });
}

describe('Categories.list', () => {
  it('builds the correct URL and returns a catId-keyed map on success', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        categories: {
          '7141123011': {
            catId: 7141123011,
            name: "Coats, Jackets & Gilets",
            contextFreeName: "Women's Coats, Jackets & Gilets",
            children: null,
            parent: 1040660,
            productCount: 12345,
          },
          '1040660': {
            catId: 1040660,
            name: "Women's Fashion",
            contextFreeName: "Women's Fashion",
            children: [7141123011],
            parent: 0,
            productCount: 999_999,
          },
        },
      }),
    );
    const client = makeClient(fakeFetch);

    const result = await client.categories.list({
      ids: [7141123011, 1040660],
      marketplace: 'GB',
    });

    expect(result[7141123011]?.contextFreeName).toBe(
      "Women's Coats, Jackets & Gilets",
    );
    expect(result[1040660]?.parent).toBe(0);
    expect(fakeFetch).toHaveBeenCalledOnce();
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toBe(
      'https://api.keepa.com/category?key=test-key&domain=2&category=7141123011,1040660&parents=0',
    );
  });

  it('returns an empty object without hitting the network when ids is empty', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    const result = await client.categories.list({ ids: [] });
    expect(result).toEqual({});
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('defaults marketplace to US (domain=1) and parents to 0', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ categories: {} }));
    const client = makeClient(fakeFetch);
    await client.categories.list({ ids: [1] });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('domain=1');
    expect(url).toContain('parents=0');
  });

  it('sends parents=1 when withParents is true', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ categories: {} }));
    const client = makeClient(fakeFetch);
    await client.categories.list({ ids: [1], withParents: true });
    expect(fakeFetch.mock.calls[0]![0] as string).toContain('parents=1');
  });

  it('returns an empty object when Keepa omits the categories field', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = makeClient(fakeFetch);
    const result = await client.categories.list({ ids: [42] });
    expect(result).toEqual({});
  });

  it('throws when marketplace is invalid', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(
      client.categories.list({ ids: [1], marketplace: 'XX' as Marketplace }),
    ).rejects.toThrow(/Invalid marketplace "XX"/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('surfaces RateLimitError on 429', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('too many', { status: 429 }));
    const client = makeClient(fakeFetch);
    await expect(
      client.categories.list({ ids: [1] }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('surfaces AuthenticationError on 401', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('bad key', { status: 401 }));
    const client = makeClient(fakeFetch);
    await expect(
      client.categories.list({ ids: [1] }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('surfaces APIError with status preserved on 500', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500 }));
    const client = makeClient(fakeFetch);
    try {
      await client.categories.list({ ids: [1] });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(500);
    }
  });
});

describe('Categories.search', () => {
  it('builds the correct URL and returns matched hits on success', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        categories: {
          '7141123011': {
            catId: 7141123011,
            name: 'Yoga Mats',
            lowestRank: 12,
            highestRank: 10_000,
            productCount: 5000,
          },
        },
      }),
    );
    const client = makeClient(fakeFetch);

    const result = await client.categories.search({
      term: 'yoga mat',
      marketplace: 'GB',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.catId).toBe(7141123011);
    expect(result[0]?.lowestRank).toBe(12);
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toBe(
      'https://api.keepa.com/search?key=test-key&domain=2&type=category&term=yoga%20mat',
    );
  });

  it('defaults marketplace to US (domain=1)', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ categories: {} }));
    const client = makeClient(fakeFetch);
    await client.categories.search({ term: 'pet hat' });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('domain=1');
    expect(url).toContain('type=category');
  });

  it('returns an empty array when Keepa has no matches', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ categories: {} }));
    const client = makeClient(fakeFetch);
    const result = await client.categories.search({ term: 'zxqwerty' });
    expect(result).toEqual([]);
  });

  it('returns an empty array when Keepa omits the categories field', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = makeClient(fakeFetch);
    const result = await client.categories.search({ term: 'foo' });
    expect(result).toEqual([]);
  });

  it('URL-encodes the term', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ categories: {} }));
    const client = makeClient(fakeFetch);
    await client.categories.search({ term: 'pet & dog' });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('term=pet%20%26%20dog');
  });

  it('throws when marketplace is invalid', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(
      client.categories.search({
        term: 'x',
        marketplace: 'XX' as Marketplace,
      }),
    ).rejects.toThrow(/Invalid marketplace "XX"/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('surfaces RateLimitError on 429', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('too many', { status: 429 }));
    const client = makeClient(fakeFetch);
    await expect(
      client.categories.search({ term: 'x' }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('surfaces AuthenticationError on 401', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('bad key', { status: 401 }));
    const client = makeClient(fakeFetch);
    await expect(
      client.categories.search({ term: 'x' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('surfaces APIError with status preserved on 500', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500 }));
    const client = makeClient(fakeFetch);
    try {
      await client.categories.search({ term: 'x' });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(500);
    }
  });
});

describe('client wiring', () => {
  it('KeepaClient.categories is a Categories instance after construction', () => {
    const client = new KeepaClient({ apiKey: 'k' });
    expect(client.categories).toBeInstanceOf(Categories);
  });
});
