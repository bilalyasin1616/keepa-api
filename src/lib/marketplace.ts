// Keys are ISO 3166-1 alpha-2; values are Keepa's `domain` query parameter.
// Domain 7 is skipped — reserved (formerly Amazon China, retired).
export const MARKETPLACE_DOMAINS = {
  US: 1,
  GB: 2,
  DE: 3,
  FR: 4,
  JP: 5,
  CA: 6,
  IT: 8,
  ES: 9,
  IN: 10,
  MX: 11,
  BR: 12,
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
