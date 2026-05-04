import { describe, it, expect, vi } from 'vitest';
import { Keepa } from '../../src/client.js';
import {
  Products,
  extractBsr,
  extractImageUrl,
  isFoundProduct,
  type KeepaProduct,
} from '../../src/resources/products.js';
import type { Marketplace } from '../../src/lib/marketplace.js';
import { RateLimitError, AuthenticationError, APIError } from '../../src/core/error.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeClient(fetchImpl: typeof globalThis.fetch): Keepa {
  return new Keepa({ apiKey: 'test-key', fetch: fetchImpl });
}

describe('Products.list', () => {
  it('builds the correct URL and returns products on success', async () => {
    const product: KeepaProduct = { asin: 'B07XYZ1234', title: 'Sample' };
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [product] }));
    const client = makeClient(fakeFetch);

    const result = await client.products.list({
      asins: ['B07XYZ1234', 'B07ABC5678'],
      marketplace: 'US',
    });

    expect(result).toEqual([product]);
    expect(fakeFetch).toHaveBeenCalledOnce();
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toBe(
      'https://api.keepa.com/product?key=test-key&domain=1&asin=B07XYZ1234,B07ABC5678&days=1',
    );
  });

  it('defaults marketplace to US (domain=1)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [] }));
    const client = makeClient(fakeFetch);
    await client.products.list({ asins: ['B07XYZ1234'] });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('domain=1');
  });

  it('respects a non-US marketplace', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [] }));
    const client = makeClient(fakeFetch);
    await client.products.list({ asins: ['B07XYZ1234'], marketplace: 'DE' });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('domain=3');
  });

  it('defaults days to 1 and lets the caller override it', async () => {
    const fakeFetch = vi.fn().mockImplementation(async () => jsonResponse({ products: [] }));
    const client = makeClient(fakeFetch);

    await client.products.list({ asins: ['B07XYZ1234'] });
    expect(fakeFetch.mock.calls[0]![0] as string).toContain('days=1');

    await client.products.list({ asins: ['B07XYZ1234'], days: 90 });
    expect(fakeFetch.mock.calls[1]![0] as string).toContain('days=90');
  });

  it('returns [] when API returns no products field', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = makeClient(fakeFetch);
    const result = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(result).toEqual([]);
  });

  it('throws when asins is empty (avoid wasted API call)', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(client.products.list({ asins: [] })).rejects.toThrow(/at least one ASIN/i);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('throws on malformed ASIN before making any HTTP call', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(client.products.list({ asins: ['B07XYZ'] })).rejects.toThrow(/Invalid ASIN/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('normalizes lowercase ASINs to uppercase before sending to Keepa', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [] }));
    const client = makeClient(fakeFetch);
    await client.products.list({ asins: ['b00mnv8e0c'], marketplace: 'US' });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('asin=B00MNV8E0C');
  });

  it('throws when marketplace is invalid', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(
      // Cast required: 'XX' isn't in the Marketplace literal union, but resolveDomainId
      // still defends against runtime-bad input (e.g. user form data).
      client.products.list({ asins: ['B07XYZ1234'], marketplace: 'XX' as Marketplace }),
    ).rejects.toThrow(/Invalid marketplace "XX"/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('surfaces RateLimitError on 429', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('too many', { status: 429 }));
    const client = makeClient(fakeFetch);
    await expect(client.products.list({ asins: ['B07XYZ1234'] })).rejects.toBeInstanceOf(RateLimitError);
  });

  it('surfaces AuthenticationError on 401', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('bad key', { status: 401 }));
    const client = makeClient(fakeFetch);
    await expect(client.products.list({ asins: ['B07XYZ1234'] })).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('surfaces APIError with status preserved on 500', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('server boom', { status: 500 }));
    const client = makeClient(fakeFetch);
    try {
      await client.products.list({ asins: ['B07XYZ1234'] });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(500);
    }
  });
});

describe('client wiring', () => {
  it('Keepa.products is a Products instance after construction', () => {
    const client = new Keepa({ apiKey: 'k' });
    expect(client.products).toBeInstanceOf(Products);
  });
});

describe('extractBsr', () => {
  it('returns null when salesRanks is undefined', () => {
    expect(extractBsr(undefined, 1)).toBeNull();
  });

  it('returns null when rootCategory is undefined', () => {
    expect(extractBsr({ '1': [123, 456] }, undefined)).toBeNull();
  });

  it('returns null when there is no entry for the root category', () => {
    expect(extractBsr({ '999': [123, 456] }, 1)).toBeNull();
  });

  it('returns null when the entry has fewer than 2 values', () => {
    expect(extractBsr({ '1': [] }, 1)).toBeNull();
    expect(extractBsr({ '1': [123] }, 1)).toBeNull();
  });

  it('returns the most recent rank (last element of [ts, rank, ts, rank, ...])', () => {
    expect(extractBsr({ '1': [1000, 50, 2000, 42] }, 1)).toBe(42);
  });

  it('skips Keepa -1 sentinel and returns the most recent real rank', () => {
    expect(extractBsr({ '1': [1000, 50, 2000, -1] }, 1)).toBe(50);
    expect(extractBsr({ '1': [1000, 50, 2000, -1, 3000, -1] }, 1)).toBe(50);
  });

  it('returns null when every rank is the -1 sentinel', () => {
    expect(extractBsr({ '1': [1000, -1, 2000, -1] }, 1)).toBeNull();
  });
});

describe('isFoundProduct', () => {
  it('true when the product has a non-empty title (Keepa returned real data)', () => {
    expect(isFoundProduct({ asin: 'B00MNV8E0C', title: 'Real Product' })).toBe(true);
  });

  it('false when title is missing (Keepa stub for unknown ASIN)', () => {
    expect(isFoundProduct({ asin: '1234567890' })).toBe(false);
  });

  it('false when title is an empty string', () => {
    expect(isFoundProduct({ asin: 'B00MNV8E0C', title: '' })).toBe(false);
  });
});

describe('extractImageUrl', () => {
  it('returns null when imagesCSV is undefined', () => {
    expect(extractImageUrl(undefined)).toBeNull();
  });

  it('returns null when imagesCSV is empty', () => {
    expect(extractImageUrl('')).toBeNull();
  });

  it('builds a region-neutral Amazon image URL from the first image in the CSV', () => {
    expect(extractImageUrl('abc123.jpg,xyz.jpg')).toBe(
      'https://m.media-amazon.com/images/I/abc123.jpg',
    );
  });
});
