export const ASIN_LENGTH = 10;
export const ASIN_REGEX = /^[A-Z0-9]{10}$/;

/** Returns true if the given string is a structurally valid ASIN
 *  (10 uppercase alphanumeric characters). Note: a passing ASIN may still
 *  not exist in Keepa's database — use `isFoundProduct` to check that. */
export function isValidAsin(value: string): boolean {
  return ASIN_REGEX.test(value);
}

/** Trim + uppercase a list of ASINs and validate each. Returns the normalized
 *  list. Throws with all invalid ASINs listed in the error message. */
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
