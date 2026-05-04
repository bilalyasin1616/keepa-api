import { describe, it, expect, vi } from 'vitest';
import { Keepa } from '../../src/client.js';
import {
  Products,
  extractBsr,
  extractImageUrl,
  isFoundProduct,
  parseImagesCsv,
} from '../../src/resources/products/products.js';
import type { KeepaProduct } from '../../src/resources/products/product.type.js';
import type { Marketplace } from '../../src/lib/marketplace.js';
import { RateLimitError, AuthenticationError, APIError } from '../../src/core/error.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeClient(fetchImpl: typeof globalThis.fetch): Keepa {
  return new Keepa({ apiKey: 'test-key', fetch: fetchImpl });
}

describe('Products.list', () => {
  it('builds the correct URL and returns processed products on success', async () => {
    // Wire shape (what Keepa actually returns) — note imagesCSV, no images/bsr fields.
    const rawProduct = {
      asin: 'B07XYZ1234',
      title: 'Sample',
      rootCategory: 1,
      salesRanks: { '1': [1000, 50, 2000, 42] },
      imagesCSV: 'aaa.jpg,bbb.jpg',
    };
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [rawProduct] }));
    const client = makeClient(fakeFetch);

    const result = await client.products.list({
      asins: ['B07XYZ1234', 'B07ABC5678'],
      marketplace: 'US',
    });

    // Processed shape: imagesCSV is gone, images[] and bsr are derived for the consumer.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      asin: 'B07XYZ1234',
      title: 'Sample',
      rootCategory: 1,
      salesRanks: { '1': [1000, 50, 2000, 42] },
      images: [
        'https://m.media-amazon.com/images/I/aaa.jpg',
        'https://m.media-amazon.com/images/I/bbb.jpg',
      ],
      bsr: 42,
    });
    expect(result[0]).not.toHaveProperty('imagesCSV');

    expect(fakeFetch).toHaveBeenCalledOnce();
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toBe(
      'https://api.keepa.com/product?key=test-key&domain=1&asin=B07XYZ1234,B07ABC5678&days=1',
    );
  });

  it('returns images: [] and bsr: null when raw fields are missing', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ products: [{ asin: 'B07XYZ1234', title: 'Sample' }] }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.images).toEqual([]);
    expect(product?.bsr).toBeNull();
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
  function processedProduct(overrides: Partial<KeepaProduct>): KeepaProduct {
    return { asin: 'B00MNV8E0C', images: [], bsr: null, ...overrides };
  }

  it('true when the product has a non-empty title (Keepa returned real data)', () => {
    expect(isFoundProduct(processedProduct({ title: 'Real Product' }))).toBe(true);
  });

  it('false when title is missing (Keepa stub for unknown ASIN)', () => {
    expect(isFoundProduct(processedProduct({ asin: '1234567890' }))).toBe(false);
  });

  it('false when title is an empty string', () => {
    expect(isFoundProduct(processedProduct({ title: '' }))).toBe(false);
  });
});

describe('parseImagesCsv', () => {
  it('returns [] for undefined or empty input', () => {
    expect(parseImagesCsv(undefined)).toEqual([]);
    expect(parseImagesCsv('')).toEqual([]);
  });

  it('builds region-neutral URLs for every comma-separated entry', () => {
    expect(parseImagesCsv('a.jpg,b.jpg,c.jpg')).toEqual([
      'https://m.media-amazon.com/images/I/a.jpg',
      'https://m.media-amazon.com/images/I/b.jpg',
      'https://m.media-amazon.com/images/I/c.jpg',
    ]);
  });

  it('skips empty entries from a malformed CSV (e.g. trailing comma)', () => {
    expect(parseImagesCsv('a.jpg,,b.jpg,')).toEqual([
      'https://m.media-amazon.com/images/I/a.jpg',
      'https://m.media-amazon.com/images/I/b.jpg',
    ]);
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
