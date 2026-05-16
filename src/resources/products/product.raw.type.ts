// Internal wire shapes — not re-exported. Products maps these into the
// consumer-friendly KeepaProduct (see product.type.ts) before returning.

export interface KeepaCategoryNodeRaw {
  catId: number;
  name: string;
}

export interface KeepaVariationAttributeRaw {
  dimension: string;
  value: string;
}

export interface KeepaVariationRaw {
  asin: string;
  attributes?: KeepaVariationAttributeRaw[];
}

export interface KeepaImageRaw {
  l: string;
  lH: number;
  lW: number;
  m: string;
  mH: number;
  mW: number;
}

export interface KeepaProductRaw {
  asin: string;
  title?: string;
  description?: string;
  parentAsin?: string;
  categoryTree?: KeepaCategoryNodeRaw[];
  rootCategory?: number;
  salesRanks?: Record<string, number[]>;
  images?: KeepaImageRaw[];
  variations?: KeepaVariationRaw[];
  features?: string[];
  // First dim is `CsvType`; second dim is `[ts, price, ts, price, ...]` where ts
  // is in Keepa minutes and price is in the smallest-currency unit. Only sent
  // when `history=1` was requested.
  csv?: number[][];
}

export interface KeepaProductResponseRaw {
  products?: KeepaProductRaw[];
}
