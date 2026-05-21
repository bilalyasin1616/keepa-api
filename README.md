# keepa-api

Lightweight TypeScript SDK for the [Keepa](https://keepa.com) REST API. A single `KeepaClient` class exposes typed resources (`products`, `categories`, `bestSellers`) with parsed responses, friendly currency units, and live rate-limit visibility.

## Installation

```bash
npm install keepa-api
# or
pnpm add keepa-api
# or
yarn add keepa-api
# or
bun add keepa-api
```

Requires Node 18+. Ships both ESM and CJS — works with `import` and `require`.

## Quickstart

```ts
import KeepaClient from 'keepa-api';

const keepa = new KeepaClient({ apiKey: process.env.KEEPA_API_KEY });

const [product] = await keepa.products.list({ asins: ['B00MNV8E0C'] });

console.log(product?.title, product?.bsr, product?.images[0]);
```

`apiKey` falls back to `process.env.KEEPA_API_KEY` when omitted.

## Client

```ts
new KeepaClient(options?)
```

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `apiKey` | `string` | `process.env.KEEPA_API_KEY` | Throws if neither is set. |
| `baseURL` | `string` | `'https://api.keepa.com'` | Override for testing/proxying. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Plug in a custom fetch (mocks, retries, etc.). |

## Products

### `keepa.products.list(params)` → `Promise<KeepaProduct[]>`

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `asins` | `string[]` | (required) | Validated + uppercased. Throws on malformed input. |
| `marketplace` | `Marketplace` | `'US'` | Case-insensitive. See [marketplaces](#marketplaces). |
| `days` | `number` | `1` | Days of csv history when `history: true`. |
| `history` | `boolean` | `false` | Populates `history.price.*` + scalar `amazonPrice` / `newPrice` / `listPrice`. Costs extra tokens. |
| `stats` | `boolean` | `false` | Populates the `stats` namespace (buy-box saving basis, etc.). Costs extra tokens. |

### `keepa.products.retrieve(params)` → `Promise<KeepaProduct>`

Same options as `list`, but takes a single `asin: string` and returns one product. Throws `ProductNotFoundError` when Keepa has no record (stub with `title === null`, or no product returned at all).

### `KeepaProduct`

The SDK reshapes Keepa's wire format into something usable:

| Field | Type | Notes |
|-------|------|-------|
| `images` | `string[]` | Full image URLs (region-neutral CDN). |
| `bsr` | `number \| null` | Latest non-sentinel BSR for `rootCategory`. |
| `amazonPrice` | `number \| null` | Latest price Amazon itself sells the product for (csv[0]) in the marketplace's **major unit** — dollars/pounds/yen/…. Null without `history: true`. |
| `newPrice` | `number \| null` | Latest lowest-3rd-party-new offer price (csv[1]). Distinct from `amazonPrice` — Amazon isn't always the cheapest new seller. |
| `listPrice` | `number \| null` | Latest list price / MSRP (csv[4]). |
| `history.price.amazon` | `PriceHistoryEntry[]` | Amazon's own price over time. Empty without `history: true`. |
| `history.price.new` | `PriceHistoryEntry[]` | Lowest-3rd-party-new price over time. |
| `history.price.list` | `PriceHistoryEntry[]` | List price (MSRP) over time. |
| `stats.buyBoxSavingBasis` | `number \| null` | Buy box strikethrough reference price in the marketplace's major unit. Null without `stats: true` or when Keepa has no saving-basis data. |
| `stats.buyBoxSavingBasisType` | `SavingBasisType \| null` | Reference type for the strikethrough — `SavingBasisType.LIST_PRICE` or `SavingBasisType.WAS_PRICE`. Null when unavailable. |
| `monthlySold` | `number \| null` | Keepa's estimate from Amazon's "X+ bought in past month" widget. Null when Amazon doesn't show the widget for this ASIN — common for lower-velocity / non-US listings. A genuine zero surfaces as `0`. |

`title`, `description`, `parentAsin`, `categoryTree`, `salesRanks`, `variations`, `features` pass through from Keepa unchanged.

**Stub records:** Keepa returns one entry per requested ASIN even for unknown ASINs — those stubs have `title === null`. Filter them out:

```ts
import { isFoundProduct } from 'keepa-api';

const found = products.filter(isFoundProduct);
```

### Price history

```ts
const [product] = await keepa.products.list({
  asins: ['B00MNV8E0C'],
  history: true,
  days: 30,
});

product.amazonPrice;              // 18.99 (USD) — Amazon's own latest
product.newPrice;                 // 16.99       — cheapest 3rd-party new
product.listPrice;                // 29.99       — MSRP
product.history.price.amazon[0];  // { timestamp: Date, price: 19.49 }
```

Prices are in the marketplace's major unit (USD dollars for `'US'`, GBP for `'GB'`, JPY for `'JP'`, …). Keepa's `-1` "no data captured" entries are filtered out.

For csv types beyond Amazon / list price (`NEW`, `USED`, `REFURBISHED`, `RATING`, …), pull the row off the raw response and parse it:

```ts
import { CsvType, parsePriceHistory } from 'keepa-api';

const usedPrices = parsePriceHistory(rawProduct.csv?.[CsvType.USED]);
```

`CsvType` covers all 36 of Keepa's csv series names verbatim.

## Categories

### `keepa.categories.list(params)` → `Promise<Record<number, KeepaCategory>>`

Resolve category metadata by browse-node id. Returns a map keyed by `catId` for lookup; ids Keepa doesn't recognise are silently absent from the result.

```ts
const cats = await keepa.categories.list({
  ids: [7141123011, 1040660],
  marketplace: 'GB',
});

cats[7141123011]?.contextFreeName; // "Women's Coats, Jackets & Gilets"
cats[7141123011]?.parent;          // 1040660
```

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `ids` | `number[]` | (required) | Browse-node ids. Empty array → no HTTP call, returns `{}`. |
| `marketplace` | `Marketplace` | `'US'` | |
| `withParents` | `boolean` | `false` | Asks Keepa for ancestor records. Empirically the shape doesn't change for most categories — walk `categoryTree` on the product if you need a breadcrumb. |

### `KeepaCategory`

| Field | Type | Notes |
|-------|------|-------|
| `catId` | `number` | Amazon browse-node id. |
| `name` | `string` | Leaf-only name (collides across departments). |
| `contextFreeName` | `string \| undefined` | Pre-disambiguated label (e.g. "Women's Coats, Jackets & Gilets"). Missing on very old / experimental nodes — fall back to `name`. |
| `parent` | `number` | Parent catId; `0` marks a root. |
| `children` | `number[] \| null` | Direct children, or `null` for leaves. |
| `productCount` | `number` | Active listings in the category. |

### `keepa.categories.search(params)` → `Promise<CategorySearchHit[]>`

Free-text search against Keepa's category index. Hits Keepa's `/search?type=category` endpoint — that endpoint is category-specific despite the generic-sounding path, so it lives here as a Categories method. Empty array on "no matches".

```ts
const hits = await keepa.categories.search({
  term: 'yoga mat',
  marketplace: 'GB',
});

hits[0]?.name;        // "Yoga Mats"
hits[0]?.lowestRank;  // Lowest BSR of any product currently in this category
```

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `term` | `string` | (required) | URL-encoded for you. |
| `marketplace` | `Marketplace` | `'US'` | |

### `CategorySearchHit`

| Field | Type | Notes |
|-------|------|-------|
| `catId` | `number` | Amazon browse-node id. |
| `name` | `string` | Leaf-only display name. |
| `lowestRank` | `number` | Lowest BSR (= strongest top performer) in the category. |
| `highestRank` | `number` | Highest BSR (= weakest top performer) in the category. |
| `productCount` | `number` | Active listings. |

## Best sellers

### `keepa.bestSellers.retrieve(params)` → `Promise<KeepaBestSellerList \| null>`

Returns `null` (not an error) when Keepa has no list for the category — typical for non-leaf nodes and sparse leaves.

```ts
const list = await keepa.bestSellers.retrieve({
  categoryId: 7141123011,
  marketplace: 'GB',
});

list?.asinList[0]; // top bestseller ASIN
```

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `categoryId` | `number` | (required) | Browse-node id. |
| `marketplace` | `Marketplace` | `'US'` | |
| `sublist` | `boolean` | `true` | When true, Keepa returns the sub-category top list (shorter). |

### `KeepaBestSellerList`

| Field | Type | Notes |
|-------|------|-------|
| `categoryId` | `number` | Echoed from Keepa, or the caller's id when Keepa omits it. |
| `asinList` | `string[]` | Top-to-bottom ordered. May be empty when the response carried no list. |

## Marketplaces

```ts
import { resolveDomainId } from 'keepa-api';

resolveDomainId('gb');      // 2 (case-insensitive)
resolveDomainId(undefined); // 1 (defaults to US)
```

| Code | Domain | Code | Domain |
|------|--------|------|--------|
| US | 1 | IT | 8 |
| GB | 2 | ES | 9 |
| DE | 3 | IN | 10 |
| FR | 4 | MX | 11 |
| JP | 5 | BR | 12 |
| CA | 6 |  |  |

Codes are ISO 3166-1 alpha-2. Domain 7 is reserved (formerly Amazon China, retired by Keepa).

## Rate limits

The client tracks Keepa's token bucket on every response — success and 429 alike — and exposes the latest snapshot:

```ts
await keepa.products.list({ asins });

if (keepa.rateLimit && keepa.rateLimit.tokensLeft < 50) {
  await sleep(keepa.rateLimit.refillIn); // ms until next token refills
}
```

On a 429, the snapshot is also attached to the thrown error:

```ts
import { RateLimitError } from 'keepa-api';

try {
  await keepa.products.list({ asins: bigBatch });
} catch (err) {
  if (err instanceof RateLimitError && err.rateLimit) {
    await sleep(err.rateLimit.refillIn);
    // retry…
  }
}
```

`RateLimitInfo`: `tokensLeft`, `refillIn` (ms), `refillRate` (tokens/min), `tokenFlowReduction`, `receivedAt`.

The SDK does **not** auto-retry on 429. Handling that is your call.

## Errors

All errors extend `KeepaError`:

```ts
import {
  KeepaError,
  APIError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
} from 'keepa-api';

try {
  await keepa.products.list({ asins });
} catch (err) {
  if (err instanceof RateLimitError)           /* 429 — err.rateLimit */;
  else if (err instanceof AuthenticationError) /* 401 — invalid API key */;
  else if (err instanceof APIError)            /* 4xx/5xx — err.status, err.body */;
  else if (err instanceof NetworkError)        /* transport — err.cause */;
  else throw err;
}
```

## ASIN utilities

```ts
import { isValidAsin, normalizeAsins } from 'keepa-api';

isValidAsin('B00MNV8E0C');           // true
normalizeAsins(['  b00mnv8e0c ']);   // ['B00MNV8E0C']
normalizeAsins(['B07XYZ']);          // throws — too short
```

`products.list` / `products.retrieve` call `normalizeAsins` for you. The regex catches malformed ASINs but can't tell you whether Keepa has the record — use `isFoundProduct` for that.

## Security note

Keepa's API authenticates via `?key=...` query parameter (not a header), so:

- **Don't run this in a browser.** Your key would be visible in DevTools and to any browser extension or middlebox.
- Server-side access logs will record full URLs (with key). Configure log scrubbing if the layer isn't trusted.
- `APIError.body` and `NetworkError.message` are scrubbed of the key before being thrown.

## License

MIT — see [LICENSE](LICENSE).
