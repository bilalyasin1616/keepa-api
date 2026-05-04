// The 11 marketplaces consumed by the existing internal projects. Keepa supports more
// (AE, NL, PL, SE, BR, TR, …); extend this map and the README marketplace table when
// a new region is needed. The numeric id is Keepa's `domain` query parameter value.
export const MARKETPLACE_DOMAINS = {
  US: 1,
  UK: 2,
  DE: 3,
  FR: 4,
  JP: 5,
  CA: 6,
  IT: 8,
  ES: 9,
  IN: 10,
  MX: 11,
  AU: 13,
} as const;

export type Marketplace = keyof typeof MARKETPLACE_DOMAINS;
export type DomainId = (typeof MARKETPLACE_DOMAINS)[Marketplace];

const SUPPORTED_LIST = Object.keys(MARKETPLACE_DOMAINS).join(', ');

export function resolveDomainId(marketplace: string | undefined): DomainId {
  const key = (marketplace ?? 'US').toUpperCase() as Marketplace;
  const domainId = MARKETPLACE_DOMAINS[key];
  if (!domainId) {
    throw new Error(
      `Invalid marketplace "${marketplace}". Supported: ${SUPPORTED_LIST}`,
    );
  }
  return domainId;
}
