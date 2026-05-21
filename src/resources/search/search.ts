import { APIResource } from '../../core/resource.js';
import { resolveDomainId } from '../../lib/marketplace.js';
import type {
  KeepaCategorySearchResult,
  SearchCategoriesParams,
} from './search.type.js';

interface SearchCategoriesResponseRaw {
  categories?: Record<string, KeepaCategorySearchResult>;
}

export class Search extends APIResource {
  /**
   * Search Keepa's category index by free-text term. Empty array on
   * "no matches" — Keepa doesn't distinguish that from a missing
   * `categories` field in the response.
   */
  async categories(
    params: SearchCategoriesParams,
  ): Promise<KeepaCategorySearchResult[]> {
    const data = await this._client._request<SearchCategoriesResponseRaw>({
      path: '/search',
      query: {
        domain: resolveDomainId(params.marketplace),
        type: 'category',
        term: params.term,
      },
      context: 'search.categories',
    });
    return Object.values(data.categories ?? {});
  }
}
