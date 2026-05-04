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
import type {
  KeepaProduct,
  KeepaProductResponse,
  ProductListParams,
} from './product.type.js';

export class Products extends APIResource {
  async list(params: ProductListParams): Promise<KeepaProduct[]> {
    if (params.asins.length === 0) {
      throw new Error('At least one ASIN is required');
    }
    const asins = normalizeAsins(params.asins);
    const domain = resolveDomainId(params.marketplace);
    const data = await this._client._request<KeepaProductResponse>({
      path: PRODUCT_PATH,
      query: {
        domain,
        asin: asins,
        days: params.days ?? DEFAULT_DAYS,
      },
      context: PRODUCT_API_CONTEXT,
    });
    return data.products ?? [];
  }
}

/** Returns true when Keepa returned an actual product record (not just a stub
 *  for an unknown ASIN). Use as a `.filter()` predicate to drop empty matches. */
export function isFoundProduct(product: KeepaProduct): boolean {
  return typeof product.title === 'string' && product.title.length > 0;
}

/** Extract the most recent real BSR from Keepa's `[ts, rank, ts, rank, ...]` salesRanks array.
 *  Walks backward through rank entries (odd indices) and skips Keepa's `-1` sentinel which
 *  marks "no data captured at that timestamp". Returns `null` if every entry is sentinel. */
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

/** Build a full Amazon image URL from the first entry in Keepa's imagesCSV. */
export function extractImageUrl(imagesCSV: string | undefined): string | null {
  if (!imagesCSV) return null;
  const firstImage = imagesCSV.split(',')[0];
  if (!firstImage) return null;
  return `${AMAZON_IMAGE_BASE}/${firstImage}`;
}
