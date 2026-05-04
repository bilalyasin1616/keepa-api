import { describe, it, expect } from 'vitest';
import KeepaDefault, {
  Keepa,
  KeepaError,
  APIError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
  MARKETPLACE_DOMAINS,
  resolveDomainId,
  VERSION,
} from '../src/index.js';

describe('public API surface (src/index.ts)', () => {
  it('default export is the Keepa class', () => {
    expect(KeepaDefault).toBe(Keepa);
  });

  it('exports the five error classes', () => {
    expect(typeof KeepaError).toBe('function');
    expect(typeof APIError).toBe('function');
    expect(typeof RateLimitError).toBe('function');
    expect(typeof AuthenticationError).toBe('function');
    expect(typeof NetworkError).toBe('function');
    expect(new RateLimitError('ctx', 'body')).toBeInstanceOf(APIError);
    expect(new APIError(500, 'ctx', 'body')).toBeInstanceOf(KeepaError);
    expect(new NetworkError('ctx', new Error('boom'))).toBeInstanceOf(KeepaError);
    expect(new NetworkError('ctx', new Error('boom'))).not.toBeInstanceOf(APIError);
  });

  it('exports marketplace utilities', () => {
    expect(MARKETPLACE_DOMAINS.US).toBe(1);
    expect(resolveDomainId('UK')).toBe(2);
  });

  it('exports VERSION as a semver-shaped string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
