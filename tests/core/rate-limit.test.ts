import { describe, it, expect } from 'vitest';
import { extractRateLimit } from '../../src/core/rate-limit.js';

describe('extractRateLimit', () => {
  it('pulls all four Keepa bucket fields from a response body', () => {
    const rl = extractRateLimit({
      tokensLeft: 240,
      refillIn: 12_345,
      refillRate: 60,
      tokenFlowReduction: 0,
      products: [],
    });
    expect(rl?.tokensLeft).toBe(240);
    expect(rl?.refillIn).toBe(12_345);
    expect(rl?.refillRate).toBe(60);
    expect(rl?.tokenFlowReduction).toBe(0);
    expect(rl?.receivedAt).toBeInstanceOf(Date);
  });

  it('defaults missing optional fields to 0 when only `tokensLeft` is present', () => {
    const rl = extractRateLimit({ tokensLeft: 100 });
    expect(rl?.tokensLeft).toBe(100);
    expect(rl?.refillIn).toBe(0);
    expect(rl?.refillRate).toBe(0);
    expect(rl?.tokenFlowReduction).toBe(0);
  });

  it('returns null for non-Keepa-shaped bodies', () => {
    expect(extractRateLimit(null)).toBeNull();
    expect(extractRateLimit(undefined)).toBeNull();
    expect(extractRateLimit('not an object')).toBeNull();
    expect(extractRateLimit({ products: [] })).toBeNull();
    expect(extractRateLimit({ tokensLeft: 'twelve' })).toBeNull();
  });
});
