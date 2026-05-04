import { describe, it, expect } from 'vitest';
import {
  KeepaError,
  APIError,
  RateLimitError,
  AuthenticationError,
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
  function res(status: number, body: string): Response {
    return new Response(body, { status });
  }

  it('returns RateLimitError on 429', async () => {
    const err = await APIError.from(res(429, 'too many'), 'product API');
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err).toBeInstanceOf(APIError);
    expect(err.status).toBe(429);
    expect(err.context).toBe('product API');
    expect(err.body).toBe('too many');
    expect(err.message).toMatch(/rate limit/i);
    expect(err.name).toBe('RateLimitError');
  });

  it('returns AuthenticationError on 401', async () => {
    const err = await APIError.from(res(401, 'bad key'), 'product API');
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/authentication/i);
    expect(err.name).toBe('AuthenticationError');
  });

  it('returns generic APIError for other 4xx/5xx', async () => {
    const err = await APIError.from(res(503, 'down'), 'product API');
    expect(err).toBeInstanceOf(APIError);
    expect(err).not.toBeInstanceOf(RateLimitError);
    expect(err).not.toBeInstanceOf(AuthenticationError);
    expect(err.status).toBe(503);
    expect(err.body).toBe('down');
  });
});
