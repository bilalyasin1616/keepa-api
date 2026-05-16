import type { Marketplace } from '../../lib/marketplace.js';

export interface ProductRequestOptions {
  /** Case-insensitive at runtime. Defaults to 'US'. */
  marketplace?: Marketplace;
  /** Defaults to 1. */
  days?: number;
  /** When true, populates `amazonPriceHistory`, `listPriceHistory`, `price`,
   *  and `listPrice` on each returned product. Increases token cost. */
  history?: boolean;
}

export interface ProductListParams extends ProductRequestOptions {
  asins: string[];
}

export interface ProductRetrieveParams extends ProductRequestOptions {
  asin: string;
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

export interface PriceHistoryEntry {
  timestamp: Date;
  /** Smallest currency unit (cents for USD, pence for GBP, etc.). */
  priceCents: number;
}

/** Flag-gated fields (`amazonPriceHistory`, `listPriceHistory`, `price`,
 *  `listPrice`) are always present on the type and default to empty/null
 *  when the corresponding request flag wasn't set. */
export interface KeepaProduct {
  asin: string;
  title?: string;
  description?: string;
  parentAsin?: string;
  categoryTree?: KeepaCategoryNode[];
  rootCategory?: number;
  salesRanks?: Record<string, number[]>;
  variations?: KeepaVariation[];
  features?: string[];

  images: string[];

  /** Null when missing or every history entry is Keepa's `-1` no-data sentinel. */
  bsr: number | null;

  /** Latest entry from `amazonPriceHistory`; null when history wasn't requested
   *  or Keepa has no data. */
  price: number | null;

  /** Latest entry from `listPriceHistory`; null when unavailable. */
  listPrice: number | null;

  /** Empty when `history: false`. Sentinel-filtered. */
  amazonPriceHistory: PriceHistoryEntry[];

  /** Empty when `history: false`. Sentinel-filtered. */
  listPriceHistory: PriceHistoryEntry[];
}
