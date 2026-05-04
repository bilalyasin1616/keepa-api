// Internal: shapes Keepa actually returns over the wire. The Products resource maps
// these into the consumer-friendly KeepaProduct (see product.type.ts) before returning,
// so callers never have to deal with the awkward forms (e.g. comma-separated imagesCSV).
// Not re-exported through resources/index.ts.

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

export interface KeepaProductRaw {
  asin: string;
  title?: string;
  description?: string;
  parentAsin?: string;
  categoryTree?: KeepaCategoryNodeRaw[];
  rootCategory?: number;
  salesRanks?: Record<string, number[]>;
  imagesCSV?: string;
  variations?: KeepaVariationRaw[];
  bulletPoints?: string[];
}

export interface KeepaProductResponseRaw {
  products?: KeepaProductRaw[];
}
