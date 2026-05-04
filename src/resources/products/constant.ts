export const PRODUCT_PATH = '/product';
// Structured tag of the form `<resource>.<method>`. Used as the `context` field on
// errors thrown from this method — keeps log aggregators able to filter cleanly as
// more methods land (categories.list, categories.search, bestsellers.retrieve, …).
export const PRODUCT_LIST_CONTEXT = 'products.list';
export const DEFAULT_DAYS = 1;

// Region-neutral Amazon image CDN. Serves the same images globally regardless of marketplace.
export const AMAZON_IMAGE_BASE = 'https://m.media-amazon.com/images/I';

// Keepa stores `-1` in salesRanks/price arrays to indicate "no data captured at that timestamp".
export const KEEPA_NO_DATA_SENTINEL = -1;

// Allowlist for image filenames in imagesCSV. Defends against path-traversal / SSRF
// shaped strings (e.g. "../../etc/passwd") in case the CSV is ever influenced by
// untrusted input. Matches typical Keepa image hashes (e.g. "61abcDEF.jpg").
export const VALID_IMAGE_FILENAME = /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
