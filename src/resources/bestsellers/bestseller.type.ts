import type { Marketplace } from '../../lib/marketplace.js';

export interface BestSellerRetrieveParams {
  /** Browse-node id of the category to fetch the best-seller list for. */
  categoryId: number;
  /** Case-insensitive at runtime. Defaults to 'US'. */
  marketplace?: Marketplace;
  /** When true, asks Keepa for the sub-category top list (shorter, faster).
   *  Default true — full lists run into thousands of ASINs per category and
   *  are rarely what callers want. */
  sublist?: boolean;
}

export interface KeepaBestSellerList {
  categoryId: number;
  /** Ordered top-to-bottom. May be empty when Keepa has no list for the
   *  category — non-leaf nodes and some sparse leaves return null at the
   *  response level (see `BestSellers.retrieve` return type). */
  asinList: string[];
}
