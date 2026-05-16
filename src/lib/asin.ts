export const ASIN_LENGTH = 10;
export const ASIN_REGEX = /^[A-Z0-9]{10}$/;

/** Structural check only — a passing ASIN may still not exist in Keepa's
 *  database; use `isFoundProduct` for that. */
export function isValidAsin(value: string): boolean {
  return ASIN_REGEX.test(value);
}

export function normalizeAsins(asins: string[]): string[] {
  const normalized = asins.map((asin) => asin.trim().toUpperCase());
  const invalid = normalized.filter((asin) => !isValidAsin(asin));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid ASIN(s): ${invalid.join(', ')}. ASINs must be ${ASIN_LENGTH} alphanumeric characters (e.g. B00MNV8E0C).`,
    );
  }
  return normalized;
}
