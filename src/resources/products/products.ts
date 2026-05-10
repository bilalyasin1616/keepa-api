import { APIResource } from '../../core/resource.js';
import { resolveDomainId } from '../../lib/marketplace.js';
import { normalizeAsins } from '../../lib/asin.js';
import {
  PRODUCT_PATH,
  PRODUCT_LIST_CONTEXT,
  DEFAULT_DAYS,
} from './constant.js';
import type {
  KeepaProduct,
  ProductListParams,
  ProductRetrieveParams,
} from './product.type.js';
import type { KeepaProductResponseRaw } from './product.raw.type.js';
import { ProductNotFoundError } from './error.js';
import { toKeepaProduct, isFoundProduct } from './product.util.js';

export class Products extends APIResource {
  async list(params: ProductListParams): Promise<KeepaProduct[]> {
    if (params.asins.length === 0) {
      throw new Error('At least one ASIN is required');
    }
    if (
      params.days !== undefined &&
      (!Number.isInteger(params.days) || params.days < 1)
    ) {
      throw new Error(`Invalid days: ${params.days}. Must be a positive integer.`);
    }
    const asins = normalizeAsins(params.asins);
    const domain = resolveDomainId(params.marketplace);
    const data = await this._client._request<KeepaProductResponseRaw>({
      path: PRODUCT_PATH,
      query: {
        domain,
        asin: asins,
        days: params.days ?? DEFAULT_DAYS,
      },
      context: PRODUCT_LIST_CONTEXT,
    });
    return (data.products ?? []).map(toKeepaProduct);
  }

  /** Fetch a single product by ASIN. Throws `ProductNotFoundError` when Keepa
   *  has no record for the ASIN (no product returned, or a stub with no title). */
  async retrieve(params: ProductRetrieveParams): Promise<KeepaProduct> {
    const { asin, ...rest } = params;
    const [product] = await this.list({ ...rest, asins: [asin] });
    if (!product || !isFoundProduct(product)) {
      throw new ProductNotFoundError(asin);
    }
    return product;
  }
}
