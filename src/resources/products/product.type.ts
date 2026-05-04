import type { Marketplace } from '../../lib/marketplace.js';

export interface ProductListParams {
  asins: string[];
  /** Marketplace code (case-insensitive at runtime). Defaults to 'US'. */
  marketplace?: Marketplace;
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

/** A Keepa product in the consumer-friendly shape. Derived from the raw Keepa
 *  response: `imagesCSV` is split into `images: string[]`, and the most-recent
 *  real BSR is surfaced as `bsr`. The raw `salesRanks` is preserved for
 *  consumers that need to walk the rank history themselves. */
export interface KeepaProduct {
  asin: string;
  title?: string;
  description?: string;
  parentAsin?: string;
  categoryTree?: KeepaCategoryNode[];
  rootCategory?: number;
  salesRanks?: Record<string, number[]>;
  variations?: KeepaVariation[];
  bulletPoints?: string[];

  /** Full image URLs derived from imagesCSV using a region-neutral Amazon CDN. */
  images: string[];

  /** Most recent real BSR for the rootCategory. Null when missing or every entry is
   *  Keepa's `-1` "no data captured" sentinel. */
  bsr: number | null;
}
