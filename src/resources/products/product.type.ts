import type { Marketplace } from '../../lib/marketplace.js';

export interface ProductRequestOptions {
  /** Case-insensitive at runtime. Defaults to 'US'. */
  marketplace?: Marketplace;
  /** Defaults to 1. */
  days?: number;
  /** When true, populates `history.price.*` and the scalar `price` / `listPrice`
   *  fields on each returned product. Increases token cost. */
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
  /** Marketplace's major unit — dollars for US, pounds for GB, yen for JP, etc. */
  price: number;
}

/** Flag-gated fields (`price`, `listPrice`, `history.price.*`) are always present
 *  on the type and default to empty/null when the corresponding request flag
 *  wasn't set. */
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

  /** Latest entry from `history.price.amazon`; null when history wasn't
   *  requested or Keepa has no data. Marketplace's major unit. */
  price: number | null;

  /** Latest entry from `history.price.list`; null when unavailable.
   *  Marketplace's major unit. */
  listPrice: number | null;

  history: {
    price: {
      /** Empty when `history: false`. Sentinel-filtered. */
      amazon: PriceHistoryEntry[];
      /** Empty when `history: false`. Sentinel-filtered. */
      list: PriceHistoryEntry[];
    };
  };
}
