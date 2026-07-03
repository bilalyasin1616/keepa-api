import { describe, it, expect, vi } from 'vitest';
import { KeepaClient } from '../../src/client.js';
import { Products } from '../../src/resources/products/products.js';
import {
  extractBsr,
  isFoundProduct,
  parseMonthlySold,
  parseReferralFeePercent,
  parsePrice,
  parsePriceHistory,
  parseSavingBasisType,
} from '../../src/resources/products/product.util.js';
import { KEEPA_EPOCH_UNIX_MS, SavingBasisType } from '../../src/resources/products/constant.js';
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
      'https://api.keepa.com/product?key=test-key&domain=1&asin=B07XYZ1234,B07ABC5678&days=1&history=0&stats=0',
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
    expect(extractBsr({ '1': [1000, 50, 2000, 42, 9999] }, 1)).toBe(42);
    // Odd length with a single trailing ts and no real ranks before — null.
    expect(extractBsr({ '1': [1000] }, 1)).toBeNull();
  });
});

describe('isFoundProduct', () => {
  function processedProduct(overrides: Partial<KeepaProduct>): KeepaProduct {
    return {
      asin: 'B00MNV8E0C',
      images: [],
      bsr: null,
      amazonPrice: null,
      newPrice: null,
      listPrice: null,
      monthlySold: null,
      referralFeePercent: null,
      history: { price: { amazon: [], new: [], list: [] } },
      stats: { buyBoxPrice: null, buyBoxSavingBasis: null, buyBoxSavingBasisType: null },
      ...overrides,
    };
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

describe('Products.list — history mode', () => {
  it('sends history=0 by default and history=1 when enabled', async () => {
    const fakeFetch = vi.fn().mockImplementation(async () => jsonResponse({ products: [] }));
    const client = makeClient(fakeFetch);

    await client.products.list({ asins: ['B07XYZ1234'] });
    expect(fakeFetch.mock.calls[0]![0] as string).toContain('history=0');

    await client.products.list({ asins: ['B07XYZ1234'], history: true });
    expect(fakeFetch.mock.calls[1]![0] as string).toContain('history=1');
  });

  it('parses csv[0] into history.price.amazon and csv[4] into history.price.list', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            asin: 'B07XYZ1234',
            title: 'Sample',
            csv: [
              [1_000_000, 1999, 2_000_000, 1899], // csv[0] AMAZON
              null,                                // csv[1] NEW (irrelevant)
              null,                                // csv[2] USED (irrelevant)
              null,                                // csv[3] SALES (irrelevant)
              [1_500_000, 2999],                   // csv[4] LISTPRICE
            ],
          },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({
      asins: ['B07XYZ1234'],
      history: true,
    });

    expect(product?.history.price.amazon).toEqual([
      { timestamp: new Date(1_000_000 * 60_000 + KEEPA_EPOCH_UNIX_MS), price: 19.99 },
      { timestamp: new Date(2_000_000 * 60_000 + KEEPA_EPOCH_UNIX_MS), price: 18.99 },
    ]);
    expect(product?.history.price.list).toEqual([
      { timestamp: new Date(1_500_000 * 60_000 + KEEPA_EPOCH_UNIX_MS), price: 29.99 },
    ]);
  });

  it('returns empty history arrays when csv is missing or the index is empty', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ products: [{ asin: 'B07XYZ1234', title: 'Sample' }] }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({
      asins: ['B07XYZ1234'],
      history: true,
    });

    expect(product?.history.price.amazon).toEqual([]);
    expect(product?.history.price.list).toEqual([]);
  });

  it('sets `amazonPrice`, `newPrice`, `listPrice` to the latest history entry when populated', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            asin: 'B07XYZ1234',
            title: 'Sample',
            csv: [
              [1_000_000, 1999, 2_000_000, 1899], // AMAZON — latest is 1899
              [1_100_000, 1799, 2_100_000, 1699], // NEW (3rd-party) — latest is 1699
              null,
              null,
              [1_500_000, 2999, 1_800_000, 2799], // LISTPRICE — latest is 2799
            ],
          },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({
      asins: ['B07XYZ1234'],
      history: true,
    });
    expect(product?.amazonPrice).toBe(18.99);
    expect(product?.newPrice).toBe(16.99);
    expect(product?.listPrice).toBe(27.99);
  });

  it('all scalar prices are null and history arrays empty when csv is missing', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ products: [{ asin: 'B07XYZ1234', title: 'Sample' }] }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({
      asins: ['B07XYZ1234'],
      history: true,
    });
    expect(product?.amazonPrice).toBeNull();
    expect(product?.newPrice).toBeNull();
    expect(product?.listPrice).toBeNull();
    expect(product?.history.price.amazon).toEqual([]);
    expect(product?.history.price.new).toEqual([]);
    expect(product?.history.price.list).toEqual([]);
  });
});

describe('Products.list — stats mode', () => {
  it('sends stats=0 by default and stats=<days> when enabled', async () => {
    const fakeFetch = vi.fn().mockImplementation(async () =>
      jsonResponse({ products: [] }),
    );
    const client = makeClient(fakeFetch);

    await client.products.list({ asins: ['B07XYZ1234'] });
    expect(fakeFetch.mock.calls[0]![0] as string).toContain('stats=0');

    await client.products.list({ asins: ['B07XYZ1234'], stats: true, days: 30 });
    expect(fakeFetch.mock.calls[1]![0] as string).toContain('stats=30');
  });

  it('parses buy-box saving basis (cents → major unit) and basis type', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            asin: 'B07XYZ1234',
            title: 'Sample',
            stats: { buyBoxPrice: 2499, buyBoxSavingBasis: 2999, buyBoxSavingBasisType: 0 },
          },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({
      asins: ['B07XYZ1234'],
      stats: true,
    });
    expect(product?.stats.buyBoxPrice).toBe(24.99);
    expect(product?.stats.buyBoxSavingBasis).toBe(29.99);
    expect(product?.stats.buyBoxSavingBasisType).toBe(SavingBasisType.LIST_PRICE);
  });

  it('stats fields are null when Keepa omits them or returns an out-of-range type', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', stats: { buyBoxSavingBasisType: 99 } },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({
      asins: ['B07XYZ1234'],
      stats: true,
    });
    expect(product?.stats.buyBoxPrice).toBeNull();
    expect(product?.stats.buyBoxSavingBasis).toBeNull();
    expect(product?.stats.buyBoxSavingBasisType).toBeNull();
  });

  it('buyBoxPrice is null for the -1 no-buy-box sentinel', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', stats: { buyBoxPrice: -1 } },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({
      asins: ['B07XYZ1234'],
      stats: true,
    });
    expect(product?.stats.buyBoxPrice).toBeNull();
  });
});

describe('Products.retrieve — history mode', () => {
  it('populates the price-history fields on the single returned product', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          {
            asin: 'B07XYZ1234',
            title: 'Real',
            csv: [[1_000_000, 1999], null, null, null, [1_500_000, 2999]],
          },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const product: KeepaProduct = await client.products.retrieve({
      asin: 'B07XYZ1234',
      history: true,
    });
    expect(product.history.price.amazon[0]?.price).toBe(19.99);
    expect(product.history.price.list[0]?.price).toBe(29.99);
  });
});

describe('parsePriceHistory', () => {
  it('converts [ts, price] pairs into PriceHistoryEntry objects', () => {
    const result = parsePriceHistory([1_000_000, 1999, 2_000_000, 1899]);
    expect(result).toEqual([
      { timestamp: new Date(1_000_000 * 60_000 + KEEPA_EPOCH_UNIX_MS), price: 19.99 },
      { timestamp: new Date(2_000_000 * 60_000 + KEEPA_EPOCH_UNIX_MS), price: 18.99 },
    ]);
  });

  it('filters out -1 "no data captured" sentinel entries', () => {
    const result = parsePriceHistory([1000, -1, 2000, 1999, 3000, -1]);
    expect(result).toHaveLength(1);
    expect(result[0]?.price).toBe(19.99);
  });

  it('returns [] for undefined, empty, or single-element series', () => {
    expect(parsePriceHistory(undefined)).toEqual([]);
    expect(parsePriceHistory([])).toEqual([]);
    expect(parsePriceHistory([1000])).toEqual([]);
  });

  it('ignores a dangling element when the series has odd length', () => {
    const result = parsePriceHistory([1000, 1999, 2000]);
    expect(result).toHaveLength(1);
    expect(result[0]?.price).toBe(19.99);
  });
});

describe('parsePrice', () => {
  it('divides a Keepa cents integer by 100', () => {
    expect(parsePrice(1999)).toBe(19.99);
    expect(parsePrice(0)).toBe(0);
  });

  it('returns null for missing, non-numeric, or non-finite values', () => {
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice('1999')).toBeNull();
    expect(parsePrice(Number.NaN)).toBeNull();
    expect(parsePrice(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('returns null for Keepa\'s -1 no-data sentinel', () => {
    expect(parsePrice(-1)).toBeNull();
  });
});

describe('Products.list — monthlySold', () => {
  it('passes Keepa monthlySold through as a positive integer', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', monthlySold: 1000 },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.monthlySold).toBe(1000);
  });

  it("maps Keepa's -1 sentinel to null (widget not shown for ASIN)", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', monthlySold: -1 },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.monthlySold).toBeNull();
  });

  it('returns null when the field is missing entirely', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ products: [{ asin: 'B07XYZ1234', title: 'Sample' }] }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.monthlySold).toBeNull();
  });

  it('preserves a genuine zero (distinct from -1 sentinel)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', monthlySold: 0 },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.monthlySold).toBe(0);
  });
});

describe('parseMonthlySold', () => {
  it('returns the value for positive integers and zero', () => {
    expect(parseMonthlySold(1000)).toBe(1000);
    expect(parseMonthlySold(0)).toBe(0);
  });

  it("returns null for Keepa's -1 no-data sentinel", () => {
    expect(parseMonthlySold(-1)).toBeNull();
  });

  it('returns null for missing or non-numeric values', () => {
    expect(parseMonthlySold(undefined)).toBeNull();
    expect(parseMonthlySold(null)).toBeNull();
    expect(parseMonthlySold('1000')).toBeNull();
    expect(parseMonthlySold(Number.NaN)).toBeNull();
    expect(parseMonthlySold(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('Products.list — referralFeePercent', () => {
  it('passes Keepa referralFeePercent through as a percent', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', referralFeePercent: 15 },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.referralFeePercent).toBe(15);
  });

  it("returns null for Keepa's -1 no-data sentinel", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', referralFeePercent: -1 },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.referralFeePercent).toBeNull();
  });

  it('returns null when the field is missing entirely', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({ products: [{ asin: 'B07XYZ1234', title: 'Sample' }] }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.referralFeePercent).toBeNull();
  });

  it('preserves a genuine zero (distinct from -1 sentinel)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        products: [
          { asin: 'B07XYZ1234', title: 'Sample', referralFeePercent: 0 },
        ],
      }),
    );
    const client = makeClient(fakeFetch);
    const [product] = await client.products.list({ asins: ['B07XYZ1234'] });
    expect(product?.referralFeePercent).toBe(0);
  });
});

describe('parseReferralFeePercent', () => {
  it('returns the value for positive numbers and zero', () => {
    expect(parseReferralFeePercent(15)).toBe(15);
    expect(parseReferralFeePercent(0)).toBe(0);
  });

  it("returns null for Keepa's -1 no-data sentinel", () => {
    expect(parseReferralFeePercent(-1)).toBeNull();
  });

  it('returns null for missing or non-numeric values', () => {
    expect(parseReferralFeePercent(undefined)).toBeNull();
    expect(parseReferralFeePercent(null)).toBeNull();
    expect(parseReferralFeePercent('15')).toBeNull();
    expect(parseReferralFeePercent(Number.NaN)).toBeNull();
    expect(parseReferralFeePercent(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('parseSavingBasisType', () => {
  it('returns the value when it matches a known SavingBasisType', () => {
    expect(parseSavingBasisType(SavingBasisType.LIST_PRICE)).toBe(SavingBasisType.LIST_PRICE);
    expect(parseSavingBasisType(SavingBasisType.WAS_PRICE)).toBe(SavingBasisType.WAS_PRICE);
  });

  it('returns null for missing or out-of-range values', () => {
    expect(parseSavingBasisType(undefined)).toBeNull();
    expect(parseSavingBasisType(99)).toBeNull();
    expect(parseSavingBasisType('LIST_PRICE')).toBeNull();
  });
});
