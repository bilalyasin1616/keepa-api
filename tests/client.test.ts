import { describe, it, expect, vi, afterEach } from 'vitest';
import { KeepaClient } from '../src/client.js';

describe('Keepa client', () => {
  const originalEnv = process.env.KEEPA_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.KEEPA_API_KEY;
    else process.env.KEEPA_API_KEY = originalEnv;
  });

  describe('apiKey resolution', () => {
    it('uses options.apiKey when provided', () => {
      const client = new KeepaClient({ apiKey: 'opt-key' });
      expect(client.apiKey).toBe('opt-key');
    });

    it('falls back to process.env.KEEPA_API_KEY', () => {
      process.env.KEEPA_API_KEY = 'env-key';
      const client = new KeepaClient();
      expect(client.apiKey).toBe('env-key');
    });

    it('options.apiKey beats env when both are set', () => {
      process.env.KEEPA_API_KEY = 'env-key';
      const client = new KeepaClient({ apiKey: 'opt-key' });
      expect(client.apiKey).toBe('opt-key');
    });

    it('throws when no apiKey is provided and env is unset', () => {
      delete process.env.KEEPA_API_KEY;
      expect(() => new KeepaClient()).toThrow(/Missing Keepa API key/);
    });

    it('throws when both options and env are empty strings', () => {
      delete process.env.KEEPA_API_KEY;
      expect(() => new KeepaClient({ apiKey: '' })).toThrow(/Missing Keepa API key/);
    });
  });

  describe('baseURL', () => {
    it('defaults to https://api.keepa.com', () => {
      const client = new KeepaClient({ apiKey: 'k' });
      expect(client.baseURL).toBe('https://api.keepa.com');
    });

    it('accepts a custom baseURL', () => {
      const client = new KeepaClient({ apiKey: 'k', baseURL: 'https://custom.test' });
      expect(client.baseURL).toBe('https://custom.test');
    });

    it('strips a trailing slash so {baseURL}{path} does not produce a double slash', () => {
      const client = new KeepaClient({ apiKey: 'k', baseURL: 'https://custom.test/' });
      expect(client.baseURL).toBe('https://custom.test');
    });
  });

  describe('_request', () => {
    it('uses the provided fetch and returns parsed JSON', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      const client = new KeepaClient({ apiKey: 'k', fetch: fakeFetch });
      const result = await client._request<{ ok: boolean }>({
        path: '/ping',
        context: 'ping',
      });
      expect(result).toEqual({ ok: true });
      expect(fakeFetch).toHaveBeenCalledOnce();
    });

    it('passes the apiKey through as the ?key= query parameter', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(
        new Response('{}', { status: 200 }),
      );
      const client = new KeepaClient({ apiKey: 'secret', fetch: fakeFetch });
      await client._request({ path: '/ping', context: 'ping' });
      const calledUrl = fakeFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toContain('key=secret');
    });
  });
});
