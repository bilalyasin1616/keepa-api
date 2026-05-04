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
