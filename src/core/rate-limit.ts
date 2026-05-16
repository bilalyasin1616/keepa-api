export interface RateLimitInfo {
  /** Tokens remaining in the bucket after this response. */
  tokensLeft: number;
  /** Milliseconds until the next token refills. */
  refillIn: number;
  /** Tokens added to the bucket per minute. */
  refillRate: number;
  /** Reduction applied to the refill rate during high system load. */
  tokenFlowReduction: number;
  /** Local time the snapshot was received. */
  receivedAt: Date;
}

// Keepa includes these fields on every response body — 200 and 429 alike — so a
// single extractor works for both the success path and the rate-limit error path.
export function extractRateLimit(body: unknown): RateLimitInfo | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.tokensLeft !== 'number') return null;
  return {
    tokensLeft: b.tokensLeft,
    refillIn: typeof b.refillIn === 'number' ? b.refillIn : 0,
    refillRate: typeof b.refillRate === 'number' ? b.refillRate : 0,
    tokenFlowReduction: typeof b.tokenFlowReduction === 'number' ? b.tokenFlowReduction : 0,
    receivedAt: new Date(),
  };
}
