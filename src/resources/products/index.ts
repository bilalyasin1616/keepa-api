export { Products } from './products.js';
export { extractBsr, isFoundProduct } from './product.util.js';
export { ProductNotFoundError } from './error.js';

export type {
  ProductListParams,
  ProductRetrieveParams,
  KeepaProduct,
  KeepaVariation,
  KeepaVariationAttribute,
  KeepaCategoryNode,
} from './product.type.js';

// NOTE: raw Keepa wire types (KeepaProductRaw, KeepaProductResponseRaw) are
// intentionally NOT re-exported. They are an implementation detail — Products.list
// maps them to the consumer-friendly KeepaProduct shape before returning.

export {
  PRODUCT_PATH,
  PRODUCT_LIST_CONTEXT,
  DEFAULT_DAYS,
  AMAZON_IMAGE_BASE,
  KEEPA_NO_DATA_SENTINEL,
} from './constant.js';
