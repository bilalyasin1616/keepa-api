import { request } from './core/request.js';
import type { RequestArgs, RequestConfig } from './core/request.js';
import type { RateLimitInfo } from './core/rate-limit.js';
import { Products } from './resources/products/products.js';
import { Categories } from './resources/categories/categories.js';
import { BestSellers } from './resources/bestsellers/bestsellers.js';
import { Search } from './resources/search/search.js';

export interface ClientOptions {
  /** Falls back to `process.env.KEEPA_API_KEY` when omitted. */
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL = 'https://api.keepa.com';

export class KeepaClient {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly fetch: typeof globalThis.fetch;

  readonly products: Products;
  readonly categories: Categories;
  readonly bestSellers: BestSellers;
  readonly search: Search;

  /** Latest rate-limit snapshot from Keepa, updated after every response.
   *  Null until the first request completes. */
  rateLimit: RateLimitInfo | null = null;

  constructor(options: ClientOptions = {}) {
    // `process` is undefined in browsers / Workers / edge runtimes — guard so the
    // constructor throws our friendly error instead of a raw ReferenceError there.
    const envApiKey =
      typeof process !== 'undefined' ? process.env?.KEEPA_API_KEY : undefined;
    const apiKey = options.apiKey || envApiKey;
    if (!apiKey) {
      throw new Error(
        'Missing Keepa API key. Pass it as `new KeepaClient({ apiKey })` or set KEEPA_API_KEY in your environment.',
      );
    }
    this.apiKey = apiKey;
    // Strip trailing slash so `${baseURL}${path}` never produces `//product`.
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    // Unbound Node fetch throws "Illegal invocation" when called with undefined `this`.
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);

    this.products = new Products(this);
    this.categories = new Categories(this);
    this.bestSellers = new BestSellers(this);
    this.search = new Search(this);
  }

  _request<T>(args: RequestArgs): Promise<T> {
    const config: RequestConfig = {
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      fetch: this.fetch,
      onRateLimit: (info) => {
        this.rateLimit = info;
      },
    };
    return request<T>(config, args);
  }
}

export default KeepaClient;
