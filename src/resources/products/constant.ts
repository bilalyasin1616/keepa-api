export const PRODUCT_PATH = '/product';
// `<resource>.<method>` tag carried on errors so log aggregators can filter cleanly.
export const PRODUCT_LIST_CONTEXT = 'products.list';
export const DEFAULT_DAYS = 1;

// Region-neutral CDN — serves identical images regardless of the marketplace.
export const AMAZON_IMAGE_BASE = 'https://m.media-amazon.com/images/I';

// Keepa stores `-1` in salesRanks/price arrays as "no data captured at that timestamp".
export const KEEPA_NO_DATA_SENTINEL = -1;

// First-dim index into Keepa's csv history matrix. Names mirror Keepa's own enum
// verbatim (see https://keepa.com/#!discuss/t/product-object/116).
export const CsvType = {
  AMAZON: 0,
  NEW: 1,
  USED: 2,
  SALES: 3,
  LISTPRICE: 4,
  COLLECTIBLE: 5,
  REFURBISHED: 6,
  NEW_FBM_SHIPPING: 7,
  LIGHTNING_DEAL: 8,
  WAREHOUSE: 9,
  NEW_FBA: 10,
  COUNT_NEW: 11,
  COUNT_USED: 12,
  COUNT_REFURBISHED: 13,
  COUNT_COLLECTIBLE: 14,
  EXTRA_INFO_UPDATES: 15,
  RATING: 16,
  COUNT_REVIEWS: 17,
  BUY_BOX_SHIPPING: 18,
  USED_NEW_SHIPPING: 19,
  USED_VERY_GOOD_SHIPPING: 20,
  USED_GOOD_SHIPPING: 21,
  USED_ACCEPTABLE_SHIPPING: 22,
  COLLECTIBLE_NEW_SHIPPING: 23,
  COLLECTIBLE_VERY_GOOD_SHIPPING: 24,
  COLLECTIBLE_GOOD_SHIPPING: 25,
  COLLECTIBLE_ACCEPTABLE_SHIPPING: 26,
  REFURBISHED_SHIPPING: 27,
  EBAY_NEW_SHIPPING: 28,
  EBAY_USED_SHIPPING: 29,
  TRADE_IN: 30,
  RENTAL: 31,
  BUY_BOX_USED_SHIPPING: 32,
  PRIME_EXCL: 33,
  COUNT_NEW_FBA: 34,
  COUNT_NEW_FBM: 35,
} as const;
export type CsvType = (typeof CsvType)[keyof typeof CsvType];

// 2011-01-01 00:00 UTC — origin of Keepa's csv minute timestamps. Convert with
// `new Date(km * 60_000 + KEEPA_EPOCH_UNIX_MS)`.
export const KEEPA_EPOCH_UNIX_MS = 1_293_840_000_000;

// Defense-in-depth allowlist for filenames in imagesCSV — rejects path-traversal
// / SSRF-shaped strings if the CSV is ever influenced by untrusted input.
export const VALID_IMAGE_FILENAME = /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i;

export const SavingBasisType = {
  LIST_PRICE: 0,
  WAS_PRICE: 1,
} as const;
export type SavingBasisType = (typeof SavingBasisType)[keyof typeof SavingBasisType];
