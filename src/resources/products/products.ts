import { APIResource } from '../../core/resource.js';
import { resolveDomainId } from '../../lib/marketplace.js';
import { normalizeAsins } from '../../lib/asin.js';
import {
  PRODUCT_PATH,
  PRODUCT_API_CONTEXT,
  DEFAULT_DAYS,
  AMAZON_IMAGE_BASE,
  KEEPA_NO_DATA_SENTINEL,
  VALID_IMAGE_FILENAME,
} from './constant.js';
import type { KeepaProduct, ProductListParams } from './product.type.js';
import type { KeepaProductRaw, KeepaProductResponseRaw } from './product.raw.type.js';

export class Products extends APIResource {
  async list(params: ProductListParams): Promise<KeepaProduct[]> {
    if (params.asins.length === 0) {
      throw new Error('At least one ASIN is required');
    }
    if (
      params.days !== undefined &&
      (!Number.isInteger(params.days) || params.days < 1)
    ) {
      throw new Error(`Invalid days: ${params.days}. Must be a positive integer.`);
    }
    const asins = normalizeAsins(params.asins);
    const domain = resolveDomainId(params.marketplace);
    const data = await this._client._request<KeepaProductResponseRaw>({
      path: PRODUCT_PATH,
      query: {
        domain,
        asin: asins,
        days: params.days ?? DEFAULT_DAYS,
      },
      context: PRODUCT_API_CONTEXT,
    });
    return (data.products ?? []).map(toKeepaProduct);
  }
}

/** Map Keepa's raw wire shape into the consumer-friendly KeepaProduct. */
function toKeepaProduct(raw: KeepaProductRaw): KeepaProduct {
  return {
    asin: raw.asin,
    title: raw.title,
    description: raw.description,
    parentAsin: raw.parentAsin,
    categoryTree: raw.categoryTree,
    rootCategory: raw.rootCategory,
    salesRanks: raw.salesRanks,
    variations: raw.variations,
    bulletPoints: raw.bulletPoints,
    images: parseImagesCsv(raw.imagesCSV),
    bsr: extractBsr(raw.salesRanks, raw.rootCategory),
  };
}

/** Returns true when Keepa returned an actual product record (not just a stub
 *  for an unknown ASIN). Use as a `.filter()` predicate to drop empty matches.
 *
 *  We use `title.length > 0` because it's the strongest single correlate of
 *  "Keepa has data" — stubs for unknown ASINs come back without a title, and
 *  every real listing has one. If Keepa's stub format changes (e.g. they start
 *  returning a placeholder title), tighten this predicate to also require
 *  `categoryTree` or another non-string field. */
export function isFoundProduct(product: KeepaProduct): boolean {
  return typeof product.title === 'string' && product.title.length > 0;
}

/** Build the full image-URL list from a Keepa imagesCSV string. Region-neutral CDN.
 *  Filters out entries that don't look like image filenames (path traversal,
 *  arbitrary extensions, etc.) — defense in case the CSV is ever influenced by
 *  untrusted input. Most consumers won't need this directly: `Products.list`
 *  already fills `images[]` on every returned product. */
export function parseImagesCsv(imagesCSV: string | undefined): string[] {
  if (!imagesCSV) return [];
  return imagesCSV
    .split(',')
    .filter((entry) => VALID_IMAGE_FILENAME.test(entry))
    .map((filename) => `${AMAZON_IMAGE_BASE}/${filename}`);
}

/** Extract the most recent real BSR from Keepa's `[ts, rank, ts, rank, ...]` salesRanks array.
 *  Walks backward through rank entries (odd indices) and skips Keepa's `-1` sentinel which
 *  marks "no data captured at that timestamp". Returns `null` if every entry is sentinel.
 *  Most consumers won't need this — `Products.list` already fills `bsr` on every returned
 *  product. Useful when working with a raw Keepa response. */
export function extractBsr(
  salesRanks: Record<string, number[]> | undefined,
  rootCategory: number | undefined,
): number | null {
  if (!salesRanks || rootCategory === undefined) return null;
  const ranks = salesRanks[String(rootCategory)];
  if (!ranks || ranks.length < 2) return null;
  // Keepa pairs are [ts, rank, ts, rank, ...]. If length is even, the last index
  // is a rank; if odd (truncated/schema drift), it's a dangling timestamp — skip
  // back one slot so we always start on a rank.
  const start = ranks.length % 2 === 0 ? ranks.length - 1 : ranks.length - 2;
  for (let i = start; i >= 1; i -= 2) {
    const rank = ranks[i];
    if (rank !== undefined && rank !== KEEPA_NO_DATA_SENTINEL) return rank;
  }
  return null;
}

/** Build a single Amazon image URL from the first entry in Keepa's imagesCSV.
 *  Equivalent to `parseImagesCsv(imagesCSV)[0] ?? null`. Useful when working with
 *  a raw Keepa response. */
export function extractImageUrl(imagesCSV: string | undefined): string | null {
  return parseImagesCsv(imagesCSV)[0] ?? null;
}
