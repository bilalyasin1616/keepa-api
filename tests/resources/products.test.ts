import { describe, it, expect, vi } from 'vitest';
import { KeepaClient } from '../../src/client.js';
import { Products } from '../../src/resources/products/products.js';
import {
  extractBsr,
  isFoundProduct,
} from '../../src/resources/products/product.util.js';
import type { KeepaProduct } from '../../src/resources/products/product.type.js';
import type { Marketplace } from '../../src/lib/marketplace.js';
import { RateLimitError, AuthenticationError, APIError } from '../../src/core/error.js';
import { ProductNotFoundError } from '../../src/resources/products/error.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeClient(fetchImpl: typeof globalThis.fetch): KeepaClient {
  return new KeepaClient({ apiKey: 'test-key', fetch: fetchImpl });
}

describe('Products.list', () => {
  it('builds the correct URL and returns processed products on success', async () => {
    // Wire shape (what Keepa actually returns) — `images` is an array of
    // {l, lH, lW, m, mH, mW} objects, no flat `images: string[]` or `bsr` field.
    const rawProduct = {
      asin: 'B07XYZ1234',
      title: 'Sample',
      rootCategory: 1,
      salesRanks: { '1': [1000, 50, 2000, 42] },
      images: [
        { l: 'aaa.jpg', lH: 1500, lW: 1500, m: 'aaa-m.jpg', mH: 500, mW: 500 },
        { l: 'bbb.jpg', lH: 1500, lW: 1500, m: 'bbb-m.jpg', mH: 500, mW: 500 },
      ],
    };
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [rawProduct] }));
    const client = makeClient(fakeFetch);

    const result = await client.products.list({
      asins: ['B07XYZ1234', 'B07ABC5678'],
      marketplace: 'US',
    });

    // Processed shape: the raw images[] objects are flattened to URL strings,
    // bsr is derived from salesRanks.
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

  it.each([
    { days: 0, label: 'zero' },
    { days: -5, label: 'negative' },
    { days: 1.5, label: 'fractional' },
    { days: Number.NaN, label: 'NaN' },
  ])('throws on invalid days ($label) before any HTTP call', async ({ days }) => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(
      client.products.list({ asins: ['B07XYZ1234'], days }),
    ).rejects.toThrow(/Invalid days/);
    expect(fakeFetch).not.toHaveBeenCalled();
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

describe('Products.retrieve', () => {
  it('returns the single product when Keepa has a real record', async () => {
    const rawProduct = {
      asin: 'B07XYZ1234',
      title: 'Sample',
      rootCategory: 1,
      salesRanks: { '1': [1000, 50, 2000, 42] },
      images: [
        { l: 'aaa.jpg', lH: 1500, lW: 1500, m: 'aaa-m.jpg', mH: 500, mW: 500 },
      ],
    };
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [rawProduct] }));
    const client = makeClient(fakeFetch);

    const product = await client.products.retrieve({ asin: 'B07XYZ1234' });

    expect(product).toMatchObject({
      asin: 'B07XYZ1234',
      title: 'Sample',
      images: ['https://m.media-amazon.com/images/I/aaa.jpg'],
      bsr: 42,
    });
    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('asin=B07XYZ1234');
  });

  it('forwards marketplace and days to the underlying request', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ products: [{ asin: 'B07XYZ1234', title: 'x' }] }),
    );
    const client = makeClient(fakeFetch);

    await client.products.retrieve({ asin: 'B07XYZ1234', marketplace: 'DE', days: 90 });

    const url = fakeFetch.mock.calls[0]![0] as string;
    expect(url).toContain('domain=3');
    expect(url).toContain('days=90');
  });

  it('throws ProductNotFoundError when Keepa returns no products', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [] }));
    const client = makeClient(fakeFetch);
    await expect(
      client.products.retrieve({ asin: 'B07XYZ1234' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('throws ProductNotFoundError when Keepa returns a stub (no title)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ products: [{ asin: 'B07XYZ1234' }] }),
    );
    const client = makeClient(fakeFetch);
    await expect(
      client.products.retrieve({ asin: 'B07XYZ1234' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('ProductNotFoundError carries the ASIN as passed by the caller', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(jsonResponse({ products: [] }));
    const client = makeClient(fakeFetch);
    try {
      await client.products.retrieve({ asin: 'B07XYZ1234' });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ProductNotFoundError);
      expect((err as ProductNotFoundError).asin).toBe('B07XYZ1234');
    }
  });

  it('propagates RateLimitError from the underlying request', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(new Response('too many', { status: 429 }));
    const client = makeClient(fakeFetch);
    await expect(
      client.products.retrieve({ asin: 'B07XYZ1234' }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('rejects malformed ASIN before any HTTP call (delegates to list validation)', async () => {
    const fakeFetch = vi.fn();
    const client = makeClient(fakeFetch);
    await expect(
      client.products.retrieve({ asin: 'B07XYZ' }),
    ).rejects.toThrow(/Invalid ASIN/);
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe('client wiring', () => {
  it('KeepaClient.products is a Products instance after construction', () => {
    const client = new KeepaClient({ apiKey: 'k' });
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

  it('handles odd-length arrays without treating a timestamp as a rank', () => {
    // [ts, rank, ts] — odd length. Naive `length-1` would point at the trailing
    // timestamp 9999 and return it as a rank. Correct behavior: skip it, return 50.
    expect(extractBsr({ '1': [1000, 50, 9999] }, 1)).toBe(50);
    // [ts, rank, ts, rank, ts] — same shape, longer.
    expect(extractBsr({ '1': [1000, 50, 2000, 42, 9999] }, 1)).toBe(42);
    // Odd length with a single trailing ts and no real ranks before — null.
    expect(extractBsr({ '1': [1000] }, 1)).toBeNull();
  });
});

describe('isFoundProduct', () => {
  function processedProduct(overrides: Partial<KeepaProduct>): KeepaProduct {
    return { asin: 'B00MNV8E0C', images: [], bsr: null, ...overrides };
  }

  it('true when the product has a title (Keepa returned real data)', () => {
    expect(isFoundProduct(processedProduct({ title: 'Real Product' }))).toBe(true);
  });

  it('false when title is null (Keepa stub for unknown ASIN)', () => {
    expect(isFoundProduct(processedProduct({ title: null as unknown as string }))).toBe(false);
  });

  it('false when title is missing entirely', () => {
    expect(isFoundProduct(processedProduct({ asin: '1234567890' }))).toBe(false);
  });
});

describe('Products.list — image mapping (raw KeepaImageRaw[] → URL string[])', () => {
  function withImages(rawImages: unknown): Promise<{ images: string[] } | undefined> {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [{ asin: 'B07XYZ1234', title: 'Sample', images: rawImages }],
      }),
    );
    const client = makeClient(fakeFetch);
    return client.products
      .list({ asins: ['B07XYZ1234'] })
      .then((result) => result[0] as { images: string[] } | undefined);
  }

  it('returns [] when raw images is missing or empty', async () => {
    expect((await withImages(undefined))?.images).toEqual([]);
    expect((await withImages([]))?.images).toEqual([]);
  });

  it('uses the large variant filename (`l`) for every entry', async () => {
    const product = await withImages([
      { l: 'aaa.jpg', lH: 1500, lW: 1500, m: 'aaa-m.jpg', mH: 500, mW: 500 },
      { l: 'bbb.jpg', lH: 1500, lW: 1500, m: 'bbb-m.jpg', mH: 500, mW: 500 },
    ]);
    expect(product?.images).toEqual([
      'https://m.media-amazon.com/images/I/aaa.jpg',
      'https://m.media-amazon.com/images/I/bbb.jpg',
    ]);
  });

  it('rejects entries whose filename does not look like an image (defense in depth)', async () => {
    const product = await withImages([
      { l: '../../etc/passwd', lH: 1, lW: 1, m: 'm.jpg', mH: 1, mW: 1 },
      { l: 'good.jpg', lH: 1500, lW: 1500, m: 'm.jpg', mH: 500, mW: 500 },
      { l: 'malware.exe', lH: 1, lW: 1, m: 'm.jpg', mH: 1, mW: 1 },
    ]);
    expect(product?.images).toEqual([
      'https://m.media-amazon.com/images/I/good.jpg',
    ]);
  });
});
