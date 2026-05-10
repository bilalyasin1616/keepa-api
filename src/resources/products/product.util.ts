import {
  AMAZON_IMAGE_BASE,
  KEEPA_NO_DATA_SENTINEL,
  VALID_IMAGE_FILENAME,
} from './constant.js';
import type { KeepaProduct } from './product.type.js';
import type { KeepaImageRaw, KeepaProductRaw } from './product.raw.type.js';

/** Map Keepa's raw wire shape into the consumer-friendly KeepaProduct. */
export function toKeepaProduct(raw: KeepaProductRaw): KeepaProduct {
  return {
    asin: raw.asin,
    title: raw.title,
    description: raw.description,
    parentAsin: raw.parentAsin,
    categoryTree: raw.categoryTree,
    rootCategory: raw.rootCategory,
    salesRanks: raw.salesRanks,
    variations: raw.variations,
    features: raw.features,
    images: rawImagesToUrls(raw.images),
    bsr: extractBsr(raw.salesRanks, raw.rootCategory),
  };
}

/** Convert Keepa's raw images array into full Amazon image URLs (the large
 *  variant). Filters entries whose filename doesn't match the expected
 *  alphanumeric image-name pattern as defense-in-depth. */
function rawImagesToUrls(images: KeepaImageRaw[] | undefined): string[] {
  if (!images || images.length === 0) return [];
  return images
    .filter((img) => typeof img.l === 'string' && VALID_IMAGE_FILENAME.test(img.l))
    .map((img) => `${AMAZON_IMAGE_BASE}/${img.l}`);
}

/** Returns true when Keepa returned an actual product record (not just a stub
 *  for an unknown ASIN). Stubs come back with `title: null`; real listings
 *  always have a string. Use as a `.filter()` predicate to drop empty matches. */
export function isFoundProduct(product: KeepaProduct): boolean {
  return product.title != null;
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
