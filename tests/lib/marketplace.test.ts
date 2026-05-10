import { describe, it, expect } from 'vitest';
import { MARKETPLACE_DOMAINS, resolveDomainId } from '../../src/lib/marketplace.js';

describe('MARKETPLACE_DOMAINS', () => {
  it('matches the documented Keepa domain ids', () => {
    expect(MARKETPLACE_DOMAINS.US).toBe(1);
    expect(MARKETPLACE_DOMAINS.GB).toBe(2);
    expect(MARKETPLACE_DOMAINS.DE).toBe(3);
    expect(MARKETPLACE_DOMAINS.FR).toBe(4);
    expect(MARKETPLACE_DOMAINS.JP).toBe(5);
    expect(MARKETPLACE_DOMAINS.CA).toBe(6);
    expect(MARKETPLACE_DOMAINS.IT).toBe(8);
    expect(MARKETPLACE_DOMAINS.ES).toBe(9);
    expect(MARKETPLACE_DOMAINS.IN).toBe(10);
    expect(MARKETPLACE_DOMAINS.MX).toBe(11);
    expect(MARKETPLACE_DOMAINS.BR).toBe(12);
  });
});

describe('resolveDomainId', () => {
  it('defaults to US (1) when undefined', () => {
    expect(resolveDomainId(undefined)).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(resolveDomainId('us')).toBe(1);
    expect(resolveDomainId('gb')).toBe(2);
    expect(resolveDomainId('De')).toBe(3);
  });

  it('throws with a helpful message on unknown marketplace', () => {
    expect(() => resolveDomainId('XX')).toThrow(/Invalid marketplace "XX"/);
    expect(() => resolveDomainId('XX')).toThrow(/Supported: US, GB, DE/);
  });

  it('throws on empty string', () => {
    expect(() => resolveDomainId('')).toThrow(/Invalid marketplace/);
  });
});
