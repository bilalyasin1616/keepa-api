import {
  AMAZON_IMAGE_BASE,
  CsvType,
  KEEPA_EPOCH_UNIX_MS,
  KEEPA_NO_DATA_SENTINEL,
  VALID_IMAGE_FILENAME,
} from './constant.js';
import type { KeepaProduct, PriceHistoryEntry } from './product.type.js';
import type { KeepaImageRaw, KeepaProductRaw } from './product.raw.type.js';

export function toKeepaProduct(raw: KeepaProductRaw): KeepaProduct {
  const amazon = parsePriceHistory(raw.csv?.[CsvType.AMAZON]);
  const list = parsePriceHistory(raw.csv?.[CsvType.LISTPRICE]);
  return {
    asin: raw.asin,
    title: raw.title,
    description: raw.description,
    parentAsin: raw.parentAsin,
    categoryTree: raw.categoryTree,
    rootCategory: raw.rootCategory,
    salesRanks: raw.salesRanks,
    variations: raw.variations,
    features: raw.features,
    images: rawImagesToUrls(raw.images),
    bsr: extractBsr(raw.salesRanks, raw.rootCategory),
    price: amazon.at(-1)?.price ?? null,
    listPrice: list.at(-1)?.price ?? null,
    history: {
      price: { amazon, list },
    },
  };
}

interface KeepaSeriesPoint {
  /** Keepa minutes — use `keepaMinutesToDate` for a JS Date. */
  timestamp: number;
  value: number;
}

// Pair up Keepa's flat `[ts, value, ts, value, ...]` series. Drops `-1` no-data
// sentinels; the `i + 1 < length` bound silently skips a dangling odd element.
function pairKeepaSeries(series: number[] | undefined): KeepaSeriesPoint[] {
  if (!series) return [];
  const points: KeepaSeriesPoint[] = [];
  for (let i = 0; i + 1 < series.length; i += 2) {
    const value = series[i + 1]!;
    if (value === KEEPA_NO_DATA_SENTINEL) continue;
    points.push({ timestamp: series[i]!, value });
  }
  return points;
}

function keepaMinutesToDate(minutes: number): Date {
  return new Date(minutes * 60_000 + KEEPA_EPOCH_UNIX_MS);
}

// Keepa stores prices as integers in the smallest unit (cents/pence/etc.) and
// scales JPY/INR/BRL the same way, so /100 produces the marketplace's major unit
// uniformly across all supported regions.
export function parsePriceHistory(series: number[] | undefined): PriceHistoryEntry[] {
  return pairKeepaSeries(series).map(({ timestamp, value }) => ({
    timestamp: keepaMinutesToDate(timestamp),
    price: value / 100,
  }));
}

// Defense-in-depth — rejects path-traversal / SSRF-shaped filenames in case the
// raw CSV is ever influenced by untrusted input.
function rawImagesToUrls(images: KeepaImageRaw[] | undefined): string[] {
  if (!images || images.length === 0) return [];
  return images
    .filter((img) => typeof img.l === 'string' && VALID_IMAGE_FILENAME.test(img.l))
    .map((img) => `${AMAZON_IMAGE_BASE}/${img.l}`);
}

/** Stubs for unknown ASINs come back with `title: null`. */
export function isFoundProduct(product: KeepaProduct): boolean {
  return product.title != null;
}

/** Latest non-sentinel rank from Keepa's `[ts, rank, ts, rank, ...]` salesRanks
 *  series for the product's rootCategory. */
export function extractBsr(
  salesRanks: Record<string, number[]> | undefined,
  rootCategory: number | undefined,
): number | null {
  if (!salesRanks || rootCategory === undefined) return null;
  return pairKeepaSeries(salesRanks[String(rootCategory)]).at(-1)?.value ?? null;
}
