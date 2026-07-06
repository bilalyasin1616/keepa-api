import type { Marketplace } from '../../lib/marketplace.js';
import type { SavingBasisType } from './constant.js';

export interface ProductRequestOptions {
  /** Case-insensitive at runtime. Defaults to 'US'. */
  marketplace?: Marketplace;
  /** Defaults to 1. */
  days?: number;
  /** When true, populates `history.price.*` and the scalar `price` / `listPrice`
   *  fields on each returned product. Increases token cost. */
  history?: boolean;
  /** When true, populates the `stats` namespace (buy-box saving basis, etc.).
   *  Increases token cost. */
  stats?: boolean;
  /** When true, requests Keepa's buy-box data (`buybox=1`), which populates
   *  `stats.buyBoxPrice`. Requires `stats: true` for the stats namespace to be
   *  present at all. Increases token cost, billed separately from `stats`. */
  buybox?: boolean;
}

export interface ProductListParams extends ProductRequestOptions {
  asins: string[];
}

export interface ProductRetrieveParams extends ProductRequestOptions {
  asin: string;
}

export interface KeepaCategoryNode {
  catId: number;
  name: string;
}

export interface KeepaVariationAttribute {
  dimension: string;
  value: string;
}

export interface KeepaVariation {
  asin: string;
  attributes?: KeepaVariationAttribute[];
}

export interface PriceHistoryEntry {
  timestamp: Date;
  /** Marketplace's major unit — dollars for US, pounds for GB, yen for JP, etc. */
  price: number;
}

/** Flag-gated fields (`amazonPrice`, `newPrice`, `listPrice`, `history.price.*`)
 *  are always present on the type and default to empty/null when the
 *  corresponding request flag wasn't set. */
export interface KeepaProduct {
  asin: string;
  title?: string;
  description?: string;
  parentAsin?: string;
  categoryTree?: KeepaCategoryNode[];
  rootCategory?: number;
  salesRanks?: Record<string, number[]>;
  variations?: KeepaVariation[];
  features?: string[];

  images: string[];

  /** Null when missing or every history entry is Keepa's `-1` no-data sentinel. */
  bsr: number | null;

  /** Latest Amazon-sold price (csv[0]) in the marketplace's major unit;
   *  null when history wasn't requested or Keepa has no data. */
  amazonPrice: number | null;

  /** Latest lowest-3rd-party-new price (csv[1]) in the marketplace's major
   *  unit. Distinct from `amazonPrice` — Amazon itself may not be the cheapest
   *  new offer. */
  newPrice: number | null;

  /** Latest list price / MSRP (csv[4]) in the marketplace's major unit. */
  listPrice: number | null;

  /** Keepa's monthly-sold estimate from Amazon's "X+ bought in past month"
   *  widget. Null when Amazon doesn't show the widget for this ASIN — common
   *  for lower-velocity / non-US listings. Distinguishable from a genuine
   *  zero, which surfaces as `0`. */
  monthlySold: number | null;

  /** Amazon referral fee as a whole-number percent of the sale price. Null when
   *  Keepa has no data (its `-1` sentinel). */
  referralFeePercent: number | null;

  history: {
    price: {
      /** Empty when `history: false`. Sentinel-filtered. */
      amazon: PriceHistoryEntry[];
      /** Empty when `history: false`. Sentinel-filtered. */
      new: PriceHistoryEntry[];
      /** Empty when `history: false`. Sentinel-filtered. */
      list: PriceHistoryEntry[];
    };
  };

  stats: {
    /** Current buy box price in the marketplace's major unit. Null unless both
     *  `stats: true` and `buybox: true` were requested, or when there's no buy
     *  box (Keepa's negative sentinels). */
    buyBoxPrice: number | null;
    /** Buy box strikethrough reference price in the marketplace's major unit.
     *  Null when `stats: false` was used or Keepa has no saving-basis data. */
    buyBoxSavingBasis: number | null;
    /** Reference type for the strikethrough price (`LIST_PRICE` or `WAS_PRICE`).
     *  Null when unavailable. */
    buyBoxSavingBasisType: SavingBasisType | null;
  };
}
