export { Products } from './products.js';
export {
  extractBsr,
  isFoundProduct,
  parsePrice,
  parsePriceHistory,
  parseSavingBasisType,
} from './product.util.js';
export { ProductNotFoundError } from './error.js';
export { CsvType, SavingBasisType } from './constant.js';

export type {
  ProductRequestOptions,
  ProductListParams,
  ProductRetrieveParams,
  KeepaProduct,
  PriceHistoryEntry,
  KeepaVariation,
  KeepaVariationAttribute,
  KeepaCategoryNode,
} from './product.type.js';

// Raw wire types (KeepaProductRaw, KeepaProductResponseRaw) are intentionally
// excluded — they're an implementation detail.

export {
  PRODUCT_PATH,
  PRODUCT_LIST_CONTEXT,
  DEFAULT_DAYS,
  AMAZON_IMAGE_BASE,
  KEEPA_NO_DATA_SENTINEL,
} from './constant.js';
