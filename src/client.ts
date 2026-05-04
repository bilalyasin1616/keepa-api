import { request } from './core/request.js';
import type { RequestArgs, RequestConfig } from './core/request.js';
import { Products } from './resources/products/products.js';

export interface ClientOptions {
  /** Keepa API key. Falls back to `process.env.KEEPA_API_KEY`. */
  apiKey?: string;
  /** Base URL for the Keepa API. Defaults to `https://api.keepa.com`. */
  baseURL?: string;
  /** Custom fetch implementation. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL = 'https://api.keepa.com';

export class Keepa {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly fetch: typeof globalThis.fetch;

  readonly products: Products;

  constructor(options: ClientOptions = {}) {
    // `process` is undefined in browsers / Cloudflare Workers / edge runtimes — guard it
    // so the constructor throws our friendly "Missing Keepa API key" message instead of a
    // raw ReferenceError on those targets.
    const envApiKey =
      typeof process !== 'undefined' ? process.env?.KEEPA_API_KEY : undefined;
    const apiKey = options.apiKey || envApiKey;
    if (!apiKey) {
      throw new Error(
        'Missing Keepa API key. Pass it as `new Keepa({ apiKey })` or set KEEPA_API_KEY in your environment.',
      );
    }
    this.apiKey = apiKey;
    this.baseURL = options.baseURL ?? DEFAULT_BASE_URL;
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);

    this.products = new Products(this);
  }

  /** Internal: used by APIResource subclasses to perform a request. */
  _request<T>(args: RequestArgs): Promise<T> {
    const config: RequestConfig = {
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      fetch: this.fetch,
    };
    return request<T>(config, args);
  }
}

export default Keepa;
