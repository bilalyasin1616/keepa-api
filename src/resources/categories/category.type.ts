import type { Marketplace } from '../../lib/marketplace.js';

export interface CategoryListParams {
  /** Browse-node ids to look up. Sent as a comma-separated list to Keepa. */
  ids: number[];
  /** Case-insensitive at runtime. Defaults to 'US'. */
  marketplace?: Marketplace;
  /** When true, requests Keepa to include ancestor records in the response.
   *  Empirically the response shape doesn't change for most categories — the
   *  flag is exposed for completeness but most consumers will leave it off
   *  (the default) and walk the breadcrumb from the product's `categoryTree`. */
  withParents?: boolean;
}

export interface KeepaCategory {
  catId: number;
  /** Leaf-only name (e.g. "Coats, Jackets & Gilets"). Collides across
   *  departments — use `contextFreeName` for the disambiguated form. */
  name: string;
  /** Keepa's pre-built disambiguated label (e.g. "Women's Coats, Jackets &
   *  Gilets"). Missing on very old / experimental nodes; callers should fall
   *  back to `name`. */
  contextFreeName?: string;
  children: number[] | null;
  /** Parent browse-node id. `0` marks a root category. */
  parent: number;
  productCount: number;
}
