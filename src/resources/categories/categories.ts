import { APIResource } from '../../core/resource.js';
import { resolveDomainId } from '../../lib/marketplace.js';
import type {
  CategoryListParams,
  CategorySearchHit,
  CategorySearchParams,
  KeepaCategory,
} from './category.type.js';

interface CategoryListResponseRaw {
  categories?: Record<string, KeepaCategory>;
}

interface CategorySearchResponseRaw {
  categories?: Record<string, CategorySearchHit>;
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

  /**
   * Free-text search against Keepa's category index. Hits the
   * `/search?type=category` endpoint — Keepa's `/search` is category-
   * specific despite the generic-sounding path, so it lives here as a
   * Categories method rather than a separate resource.
   *
   * Empty array on "no matches" — Keepa doesn't distinguish that from a
   * missing `categories` field in the response.
   */
  async search(params: CategorySearchParams): Promise<CategorySearchHit[]> {
    const data = await this._client._request<CategorySearchResponseRaw>({
      path: '/search',
      query: {
        domain: resolveDomainId(params.marketplace),
        type: 'category',
        term: params.term,
      },
      context: 'categories.search',
    });
    return Object.values(data.categories ?? {});
  }
}
