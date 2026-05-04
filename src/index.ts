export { Keepa as default, Keepa, type ClientOptions } from './client.js';

export {
  KeepaError,
  APIError,
  RateLimitError,
  AuthenticationError,
} from './core/error.js';

export { APIResource } from './core/resource.js';

export {
  MARKETPLACE_DOMAINS,
  resolveDomainId,
  type Marketplace,
  type DomainId,
} from './lib/marketplace.js';

export * from './resources/index.js';

export { VERSION } from './version.js';
