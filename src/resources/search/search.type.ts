import type { Marketplace } from '../../lib/marketplace.js';

export interface SearchCategoriesParams {
  /** Free-text search query (e.g. "dog hat", "yoga mat"). Keepa runs its own
   *  category-name fuzzy match. */
  term: string;
  /** Case-insensitive at runtime. Defaults to 'US'. */
  marketplace?: Marketplace;
}

export interface KeepaCategorySearchResult {
  catId: number;
  name: string;
  /** Lowest BSR seen for any product currently in the category — a rough
   *  proxy for "how competitive is this category at the top". */
  lowestRank: number;
  /** Highest BSR (i.e. weakest top performer) in the category. */
  highestRank: number;
  productCount: number;
}
