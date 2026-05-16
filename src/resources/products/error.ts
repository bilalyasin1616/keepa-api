import { KeepaError } from '../../core/error.js';

/** Thrown when Keepa returns no product, or returns a stub (title === null).
 *  `asin` carries the caller's original input unchanged. */
export class ProductNotFoundError extends KeepaError {
  readonly asin: string;

  constructor(asin: string) {
    super(`Keepa: no product found for ASIN ${asin}`);
    this.name = 'ProductNotFoundError';
    this.asin = asin;
  }
}
