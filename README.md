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
npm install github:<your-username>/keepa-api#feature/keepa-products-package
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
| `marketplace` | `'US' \| 'UK' \| 'DE' \| 'FR' \| 'JP' \| 'CA' \| 'IT' \| 'ES' \| 'IN' \| 'MX' \| 'AU'` | `'US'` | Case-insensitive. Throws on unknown. |
| `days` | `number` | `1` | Days of price history to include. |

Returns the array as Keepa returned it. **Note:** Keepa returns one record per requested ASIN even when it has no data — these stub records have most fields null/undefined. Use `isFoundProduct` to filter them out (see below).

### Helpers

```ts
import { isFoundProduct, extractBsr, extractImageUrl } from 'keepa-api';

const real = products.filter(isFoundProduct);

for (const product of real) {
  const bsr = extractBsr(product.salesRanks, product.rootCategory);
  const image = extractImageUrl(product.imagesCSV);
}
```

| Helper | Signature | Returns |
|--------|-----------|---------|
| `isFoundProduct(p)` | `(p: KeepaProduct) => boolean` | `true` only if Keepa returned real data (`title` is non-empty). |
| `extractBsr(salesRanks, rootCategory)` | `(Record<string, number[]> \| undefined, number \| undefined) => number \| null` | Most recent BSR from Keepa's `[ts, rank, ...]` history. |
| `extractImageUrl(imagesCSV)` | `(string \| undefined) => string \| null` | Full Amazon image URL from the first entry in Keepa's CSV. |

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
resolveDomainId('uk');    // 2 (case-insensitive)
resolveDomainId(undefined); // 1 (defaults to US)
```

| Code | Domain ID | Code | Domain ID |
|------|-----------|------|-----------|
| US   | 1         | IT   | 8         |
| UK   | 2         | ES   | 9         |
| DE   | 3         | IN   | 10        |
| FR   | 4         | MX   | 11        |
| JP   | 5         | AU   | 13        |
| CA   | 6         |      |           |

### Errors

All errors thrown by API calls extend `KeepaError`. Catch the specific subclasses for status-aware handling:

```ts
import { RateLimitError, AuthenticationError, APIError, KeepaError } from 'keepa-api';

try {
  await keepa.products.list({ asins: ['B00MNV8E0C'] });
} catch (err) {
  if (err instanceof RateLimitError) /* 429 */;
  else if (err instanceof AuthenticationError) /* 401 — bad API key */;
  else if (err instanceof APIError) /* 4xx/5xx — err.status, err.body */;
  else if (err instanceof KeepaError) /* something else from this SDK */;
  else throw err;
}
```

## Scripts

```bash
npm test            # vitest run — unit tests
npm run test:watch  # vitest watch
npm run build       # tsc → dist/
npm run example     # runs examples/basic.ts against real Keepa (needs .env)
npm run clean       # rm -rf dist
```

## Roadmap

- [ ] `Categories` resource (`fetchKeepaCategories`)
- [ ] `Categories.search` (`searchKeepaCategories`)
- [ ] `Bestsellers.retrieve` (`fetchKeepaBestSeller`)
- [ ] CommonJS build alongside ESM
- [ ] Publish to npm

## License

MIT — see [LICENSE](LICENSE).
