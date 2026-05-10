# keepa-api

Lightweight TypeScript SDK for the [Keepa](https://keepa.com) REST API. Mirrors the organizational style of [openai-node](https://github.com/openai/openai-node) — a single `Keepa` client class exposes resources (`products`, etc.) that wrap each endpoint with typed inputs and responses.

Phase 1 ships the **Products** resource only. Categories, Search, and Bestsellers are planned but not yet implemented.

## Requirements

- Node.js **≥ 18** (uses native `fetch`)
- A Keepa API key — sign up at [keepa.com/api](https://keepa.com/api.html)
- ESM consumer (your `package.json` should have `"type": "module"`, or you must be able to `import()` an ESM package)

## Installation

This package is **not yet published to npm**. Install it locally or from GitHub.

### From a local checkout (during development)

```bash
# In keepa-api/
npm install
npm run build
npm link

# In your other project:
npm link keepa-api
```

After this, edits in `keepa-api/src/` only need `npm run build` — the consumer sees the new `dist/` immediately.

### From GitHub (no npm publish needed)

```bash
npm install github:bilalyasin1616/keepa-api#feature/keepa-products-package
```

(Replace the branch with `main` once the work is merged.)

### From a tarball

```bash
# In keepa-api/
npm pack          # produces keepa-api-0.1.0.tgz

# In your other project:
npm install /absolute/path/to/keepa-api-0.1.0.tgz
```

## Quickstart

```ts
import Keepa from 'keepa-api';

const keepa = new Keepa({ apiKey: process.env.KEEPA_API_KEY });

const products = await keepa.products.list({
  asins: ['B00MNV8E0C'],
  marketplace: 'US',
});

console.log(products[0]?.title);
```

The client reads `process.env.KEEPA_API_KEY` if you don't pass `apiKey` explicitly. Put your key in a gitignored `.env` (see `.env.example` for the shape).

## API

### `new Keepa(options?)`

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `apiKey` | `string` | `process.env.KEEPA_API_KEY` | Throws if neither is set. |
| `baseURL` | `string` | `'https://api.keepa.com'` | Override for testing/proxying. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Plug in a custom fetch (mocks, retries, etc.). |

### `keepa.products.list(params)` → `Promise<KeepaProduct[]>`

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `asins` | `string[]` | (required) | Validated + uppercased. Throws on malformed input. |
| `marketplace` | `'US' \| 'GB' \| 'DE' \| 'FR' \| 'JP' \| 'CA' \| 'IT' \| 'ES' \| 'IN' \| 'MX' \| 'BR'` | `'US'` | Case-insensitive. Throws on unknown. |
| `days` | `number` | `1` | Days of price history. Must be a positive integer (validated pre-flight). |

The SDK maps Keepa's raw wire shape into a friendlier `KeepaProduct`:

- `images: string[]` — full image URLs (region-neutral CDN). Replaces Keepa's awkward `imagesCSV` string.
- `bsr: number | null` — most recent real BSR for the product's `rootCategory`. `null` when missing or every history entry is Keepa's `-1` "no data captured" sentinel.

The raw `salesRanks` record is preserved for consumers that need to walk the full rank history. Other Keepa fields (`title`, `parentAsin`, `categoryTree`, `variations`, `features`, …) pass through unchanged.

**Stub records:** Keepa returns one record per requested ASIN even when it has no data — these stubs have `title === null`. Filter with `isFoundProduct` (below).

### Helpers

```ts
import { isFoundProduct } from 'keepa-api';

const real = products.filter(isFoundProduct);

for (const product of real) {
  console.log(product.bsr);          // already populated by the SDK
  console.log(product.images[0]);    // already populated by the SDK
}
```

| Helper | Signature | Returns |
|--------|-----------|---------|
| `isFoundProduct(product)` | `(product: KeepaProduct) => boolean` | `true` only if Keepa returned real data (stubs have `title === null`). |
| `parseImagesCsv(csv)` | `(csv: string \| undefined) => string[]` | Build the full image-URL list from a raw Keepa imagesCSV. Used internally to fill `images`; exported for advanced use. |
| `extractBsr(salesRanks, rootCategory)` | `(salesRanks: Record<string, number[]> \| undefined, rootCategory: number \| undefined) => number \| null` | Most recent real BSR from Keepa's raw `[ts, rank, ...]` history. Used internally to fill `bsr`; exported for advanced use. |
| `extractImageUrl(imagesCSV)` | `(imagesCSV: string \| undefined) => string \| null` | Single URL — equivalent to `parseImagesCsv(imagesCSV)[0] ?? null`. Exported for advanced use. |

### ASIN validation

```ts
import { ASIN_REGEX, ASIN_LENGTH, isValidAsin, normalizeAsins } from 'keepa-api';

isValidAsin('B00MNV8E0C');           // true
isValidAsin('b00mnv8e0c');           // false (lowercase — use normalizeAsins to coerce)
isValidAsin('B07XYZ');               // false (too short)

normalizeAsins(['  b00mnv8e0c ']);   // ['B00MNV8E0C']
normalizeAsins(['B07XYZ']);          // throws: Invalid ASIN(s): B07XYZ. ...
```

`Products.list` calls `normalizeAsins` for you, so you don't need to pre-validate unless you're doing form-level checking.

**Caveat:** The regex catches *malformed* input. It cannot catch "Keepa has no record" — for example `1234567890` is a structurally valid ISBN-10 shape and passes the regex, but Keepa returns a stub record. Use `isFoundProduct` to filter those.

### Marketplaces

```ts
import { MARKETPLACE_DOMAINS, resolveDomainId } from 'keepa-api';

MARKETPLACE_DOMAINS.US;   // 1
resolveDomainId('gb');    // 2 (case-insensitive)
resolveDomainId(undefined); // 1 (defaults to US)
```

| Code | Domain ID | Code | Domain ID |
|------|-----------|------|-----------|
| US   | 1         | IT   | 8         |
| GB   | 2         | ES   | 9         |
| DE   | 3         | IN   | 10        |
| FR   | 4         | MX   | 11        |
| JP   | 5         | BR   | 12        |
| CA   | 6         |      |           |

### Errors

All errors thrown by API calls extend `KeepaError`. Catch the specific subclasses for status-aware handling:

```ts
import {
  RateLimitError,
  AuthenticationError,
  APIError,
  NetworkError,
  KeepaError,
} from 'keepa-api';

try {
  await keepa.products.list({ asins: ['B00MNV8E0C'] });
} catch (err) {
  if (err instanceof RateLimitError) /* 429 */;
  else if (err instanceof AuthenticationError) /* 401 — bad API key */;
  else if (err instanceof APIError) /* 4xx/5xx — err.status, err.body */;
  else if (err instanceof NetworkError) /* DNS/ECONNREFUSED/abort — err.cause has the original */;
  else if (err instanceof KeepaError) /* something else from this SDK */;
  else throw err;
}
```

### API key handling

Keepa's REST API requires the key as a `?key=...` query parameter — that's their contract, not a choice we made. Practical implications:

- **Server-side proxy / access logs** will record full URLs (key included). Configure log scrubbing if you can't trust the layer.
- **Don't run this in the browser.** A client-side request would expose your key in DevTools' Network tab and to any browser extension or middlebox.
- The `NetworkError.body` and `APIError.body` fields capture Keepa's response body. Keepa doesn't echo your key in error bodies, but if you log them to a customer-facing surface, sanity-check the contents first.

## Scripts

```bash
npm test            # vitest run — unit tests
npm run test:watch  # vitest watch
npm run build       # tsc → dist/
npm run example     # runs examples/basic.ts against real Keepa (needs .env)
npm run clean       # rm -rf dist
```

## Roadmap

**Resources**
- [ ] `Categories` resource (`fetchKeepaCategories`)
- [ ] `Categories.search` (`searchKeepaCategories`)
- [ ] `Bestsellers.retrieve` (`fetchKeepaBestSeller`)

**Request layer**
- [ ] `AbortSignal` / configurable timeout on `Products.list` (default ~30s) — currently a hung Keepa server keeps the request pending forever
- [ ] Pass-through `init` (method, headers, signal) on `core/request` for resources that need POST or custom headers
- [ ] Cap `asins.length` at Keepa's per-call limit (100) instead of letting Keepa silently truncate
- [ ] Optional `retryOn429` (with backoff) — currently we throw `RateLimitError` immediately; consumers handle pacing in their own code

**Distribution**
- [ ] CommonJS build alongside ESM
- [ ] Publish to npm

## License

MIT — see [LICENSE](LICENSE).
