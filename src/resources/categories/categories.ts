import { APIResource } from '../../core/resource.js';
import { resolveDomainId } from '../../lib/marketplace.js';
import type { CategoryListParams, KeepaCategory } from './category.type.js';

interface CategoryListResponseRaw {
  categories?: Record<string, KeepaCategory>;
}

export class Categories extends APIResource {
  /**
   * Resolve category metadata by browse-node id. Returns a map keyed by
   * `catId` for easy lookup; missing ids in the response (Keepa silently
   * omits unknown nodes) are simply absent from the result.
   */
  async list(
    params: CategoryListParams,
  ): Promise<Record<number, KeepaCategory>> {
    if (params.ids.length === 0) return {};
    const data = await this._client._request<CategoryListResponseRaw>({
      path: '/category',
      query: {
        domain: resolveDomainId(params.marketplace),
        category: params.ids,
        parents: params.withParents ? 1 : 0,
      },
      context: 'categories.list',
    });
    const out: Record<number, KeepaCategory> = {};
    for (const [idStr, cat] of Object.entries(data.categories ?? {})) {
      out[Number(idStr)] = cat;
    }
    return out;
  }
}
