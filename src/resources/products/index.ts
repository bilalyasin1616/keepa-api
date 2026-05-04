export { Products, extractBsr, isFoundProduct } from './products.js';

export type {
  ProductListParams,
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
