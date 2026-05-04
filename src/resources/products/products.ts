import { APIResource } from '../../core/resource.js';
import { resolveDomainId } from '../../lib/marketplace.js';
import { normalizeAsins } from '../../lib/asin.js';
import {
  PRODUCT_PATH,
  PRODUCT_API_CONTEXT,
  DEFAULT_DAYS,
  AMAZON_IMAGE_BASE,
  KEEPA_NO_DATA_SENTINEL,
} from './constant.js';
import type { KeepaProduct, ProductListParams } from './product.type.js';
import type { KeepaProductRaw, KeepaProductResponseRaw } from './product.raw.type.js';

export class Products extends APIResource {
  async list(params: ProductListParams): Promise<KeepaProduct[]> {
    if (params.asins.length === 0) {
      throw new Error('At least one ASIN is required');
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
 *  for an unknown ASIN). Use as a `.filter()` predicate to drop empty matches. */
export function isFoundProduct(product: KeepaProduct): boolean {
  return typeof product.title === 'string' && product.title.length > 0;
}

/** Build the full image-URL list from a Keepa imagesCSV string. Region-neutral CDN.
 *  Most consumers won't need this directly — `Products.list` already fills `images[]`
 *  on every returned product. Useful when working with a raw Keepa response. */
export function parseImagesCsv(imagesCSV: string | undefined): string[] {
  if (!imagesCSV) return [];
  return imagesCSV
    .split(',')
    .filter((entry) => entry.length > 0)
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
  for (let i = ranks.length - 1; i >= 1; i -= 2) {
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
