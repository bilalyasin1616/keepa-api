import { describe, it, expect, vi } from 'vitest';
import { KeepaClient } from '../../src/client.js';
import { BestSellers } from '../../src/resources/bestsellers/bestsellers.js';
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

describe('BestSellers.retrieve', () => {
  it('builds the correct URL and returns the parsed list on success', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        bestSellersList: {
          categoryId: 7141123011,
          asinList: ['B07XYZ1234', 'B08ABC5678', 'B09DEF9012'],
        },
      }),
    );
    const client = makeClient(fakeFetch);

    const result = await client.bestSellers.retrieve({
      categoryId: 7141123011,
      marketplace: 'GB',
    });

    expect(result).toEqual({
      categoryId: 7141123011,
      asinList: ['B07XYZ1234', 'B08ABC5678', 'B09DEF9012'],
    });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toBe(
      'https://api.keepa.com/bestsellers?key=test-key&domain=2&category=7141123011&sublist=1',
    );
  });

  it('defaults marketplace to US (domain=1) and sublist to 1', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ bestSellersList: null }));
    const client = makeClient(fakeFetch);
    await client.bestSellers.retrieve({ categoryId: 12345 });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('domain=1');
    expect(url).toContain('sublist=1');
  });

  it('sends sublist=0 when sublist:false is passed', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ bestSellersList: null }));
    const client = makeClient(fakeFetch);
    await client.bestSellers.retrieve({ categoryId: 1, sublist: false });
    expect(fakeFetch.mock.calls[0]![0] as string).toContain('sublist=0');
  });

  it('returns null when Keepa returns bestSellersList: null (non-leaf nodes)', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ bestSellersList: null }));
    const client = makeClient(fakeFetch);
    const result = await client.bestSellers.retrieve({ categoryId: 1 });
    expect(result).toBeNull();
  });

  it('returns null when Keepa omits the bestSellersList field entirely', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = makeClient(fakeFetch);
    const result = await client.bestSellers.retrieve({ categoryId: 1 });
    expect(result).toBeNull();
  });

  it('falls back to the caller categoryId when Keepa response omits it', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ bestSellersList: { asinList: ['B07XYZ1234'] } }),
    );
    const client = makeClient(fakeFetch);
    const result = await client.bestSellers.retrieve({ categoryId: 42 });
    expect(result).toEqual({ categoryId: 42, asinList: ['B07XYZ1234'] });
  });

  it('defaults asinList to [] when present but missing the field', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ bestSellersList: { categoryId: 42 } }),
    );
    const client = makeClient(fakeFetch);
    const result = await client.bestSellers.retrieve({ categoryId: 42 });
    expect(result?.asinList).toEqual([]);
  });

  it('throws when marketplace is invalid', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(
      client.bestSellers.retrieve({
        categoryId: 1,
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
      client.bestSellers.retrieve({ categoryId: 1 }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('surfaces AuthenticationError on 401', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('bad key', { status: 401 }));
    const client = makeClient(fakeFetch);
    await expect(
      client.bestSellers.retrieve({ categoryId: 1 }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('surfaces APIError with status preserved on 500', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500 }));
    const client = makeClient(fakeFetch);
    try {
      await client.bestSellers.retrieve({ categoryId: 1 });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(500);
    }
  });
});

describe('client wiring', () => {
  it('KeepaClient.bestSellers is a BestSellers instance after construction', () => {
    const client = new KeepaClient({ apiKey: 'k' });
    expect(client.bestSellers).toBeInstanceOf(BestSellers);
  });
});
