import { APIResource } from '../core/resource.js';
import { resolveDomainId, type Marketplace } from '../lib/marketplace.js';

const PRODUCT_PATH = '/product';
const PRODUCT_API_CONTEXT = 'product API';
const DEFAULT_DAYS = 1;
const AMAZON_IMAGE_BASE = 'https://images-na.ssl-images-amazon.com/images/I';

export interface ProductListParams {
  asins: string[];
  marketplace?: Marketplace | string;
  /** Days of price history to include. Defaults to 1. */
  days?: number;
}

export interface KeepaCategoryNode {
  catId: number;
  name: string;
}

export interface KeepaVariationAttribute {
  dimension: string;
  value: string;
}

export interface KeepaVariation {
  asin: string;
  attributes?: KeepaVariationAttribute[];
}

export interface KeepaProduct {
  asin: string;
  title?: string;
  description?: string;
  parentAsin?: string;
  categoryTree?: KeepaCategoryNode[];
  rootCategory?: number;
  salesRanks?: Record<string, number[]>;
  imagesCSV?: string;
  variations?: KeepaVariation[];
  bulletPoints?: string[];
}

export interface KeepaProductResponse {
  products?: KeepaProduct[];
}

export class Products extends APIResource {
  async list(params: ProductListParams): Promise<KeepaProduct[]> {
    if (params.asins.length === 0) {
      throw new Error('At least one ASIN is required');
    }
    const domain = resolveDomainId(params.marketplace);
    const data = await this._client._request<KeepaProductResponse>({
      path: PRODUCT_PATH,
      query: {
        domain,
        asin: params.asins,
        days: params.days ?? DEFAULT_DAYS,
      },
      context: PRODUCT_API_CONTEXT,
    });
    return data.products ?? [];
  }
}

/** Extract the most recent BSR from Keepa's `[ts, rank, ts, rank, ...]` salesRanks array. */
export function extractBsr(
  salesRanks: Record<string, number[]> | undefined,
  rootCategory: number | undefined,
): number | null {
  if (!salesRanks || rootCategory === undefined) return null;
  const ranks = salesRanks[String(rootCategory)];
  if (!ranks || ranks.length < 2) return null;
  return ranks[ranks.length - 1] ?? null;
}

/** Build a full Amazon image URL from the first entry in Keepa's imagesCSV. */
export function extractImageUrl(imagesCSV: string | undefined): string | null {
  if (!imagesCSV) return null;
  const firstImage = imagesCSV.split(',')[0];
  if (!firstImage) return null;
  return `${AMAZON_IMAGE_BASE}/${firstImage}`;
}
