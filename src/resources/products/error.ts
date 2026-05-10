import { KeepaError } from '../../core/error.js';

/** Thrown by `Products.retrieve` when Keepa has no record for the requested ASIN
 *  (either no product object returned, or a stub with no title). The `asin`
 *  property carries the value the caller passed in, unchanged, so it can be
 *  surfaced in user-facing messages without re-deriving it. */
export class ProductNotFoundError extends KeepaError {
  readonly asin: string;

  constructor(asin: string) {
    super(`Keepa: no product found for ASIN ${asin}`);
    this.name = 'ProductNotFoundError';
    this.asin = asin;
  }
}
