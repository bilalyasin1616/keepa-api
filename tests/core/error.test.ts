import { describe, it, expect } from 'vitest';
import {
  KeepaError,
  APIError,
  RateLimitError,
  AuthenticationError,
  NetworkError,
} from '../../src/core/error.js';

describe('KeepaError', () => {
  it('extends native Error and sets name', () => {
    const err = new KeepaError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KeepaError);
    expect(err.message).toBe('boom');
    expect(err.name).toBe('KeepaError');
  });
});

describe('APIError', () => {
  it('captures status, context, body and formats a default message', () => {
    const err = new APIError(500, 'product API', 'server boom');
    expect(err).toBeInstanceOf(KeepaError);
    expect(err).toBeInstanceOf(APIError);
    expect(err.status).toBe(500);
    expect(err.context).toBe('product API');
    expect(err.body).toBe('server boom');
    expect(err.message).toBe('Keepa product API error (500): server boom');
    expect(err.name).toBe('APIError');
  });

  it('accepts a custom message override', () => {
    const err = new APIError(418, 'product API', 'teapot', 'I am a teapot');
    expect(err.message).toBe('I am a teapot');
    expect(err.status).toBe(418);
  });
});

describe('APIError.from', () => {
  it('returns RateLimitError on 429', () => {
    const err = APIError.from(429, 'product API', 'too many');
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err).toBeInstanceOf(APIError);
    expect(err.status).toBe(429);
    expect(err.context).toBe('product API');
    expect(err.body).toBe('too many');
    expect(err.message).toMatch(/rate limit/i);
    expect(err.name).toBe('RateLimitError');
  });

  it('attaches the rate-limit snapshot to RateLimitError when provided', () => {
    const snapshot = {
      tokensLeft: 0,
      refillIn: 12_345,
      refillRate: 60,
      tokenFlowReduction: 0,
      receivedAt: new Date(),
    };
    const err = APIError.from(429, 'product API', 'too many', snapshot);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).rateLimit).toBe(snapshot);
  });

  it('returns AuthenticationError on 401', () => {
    const err = APIError.from(401, 'product API', 'bad key');
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/authentication/i);
    expect(err.name).toBe('AuthenticationError');
  });

  it('returns generic APIError for other 4xx/5xx', () => {
    const err = APIError.from(503, 'product API', 'down');
    expect(err).toBeInstanceOf(APIError);
    expect(err).not.toBeInstanceOf(RateLimitError);
    expect(err).not.toBeInstanceOf(AuthenticationError);
    expect(err.status).toBe(503);
    expect(err.body).toBe('down');
  });
});

describe('NetworkError', () => {
  it('extends KeepaError and surfaces the underlying cause', () => {
    const cause = new TypeError('ECONNREFUSED');
    const err = new NetworkError('product API', cause);
    expect(err).toBeInstanceOf(KeepaError);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err).not.toBeInstanceOf(APIError);
    expect(err.context).toBe('product API');
    expect(err.cause).toBe(cause);
    expect(err.message).toMatch(/network error.*ECONNREFUSED/);
    expect(err.name).toBe('NetworkError');
  });

  it('handles non-Error causes by stringifying them', () => {
    const err = new NetworkError('product API', 'raw string');
    expect(err.cause).toBe('raw string');
    expect(err.message).toMatch(/network error.*raw string/);
  });
});
