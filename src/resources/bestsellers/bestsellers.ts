import { APIResource } from '../../core/resource.js';
import { resolveDomainId } from '../../lib/marketplace.js';
import type {
  BestSellerRetrieveParams,
  KeepaBestSellerList,
} from './bestseller.type.js';

interface BestSellersResponseRaw {
  bestSellersList?: {
    asinList?: string[];
    categoryId?: number;
  } | null;
}

export class BestSellers extends APIResource {
  /**
   * Fetch the best-seller list for a category. Returns null when Keepa has
   * no list (typical for non-leaf nodes and sparse leaves) rather than
   * throwing — callers usually want to surface "no data" as a row state,
   * not an error.
   */
  async retrieve(
    params: BestSellerRetrieveParams,
  ): Promise<KeepaBestSellerList | null> {
    const data = await this._client._request<BestSellersResponseRaw>({
      path: '/bestsellers',
      query: {
        domain: resolveDomainId(params.marketplace),
        category: params.categoryId,
        sublist: params.sublist === false ? 0 : 1,
      },
      context: 'bestsellers.retrieve',
    });
    if (!data.bestSellersList) return null;
    return {
      categoryId: data.bestSellersList.categoryId ?? params.categoryId,
      asinList: data.bestSellersList.asinList ?? [],
    };
  }
}
