import { describe, it, expect } from 'vitest';
import { APIResource } from '../../src/core/resource.js';
import { Keepa } from '../../src/client.js';

class FakeResource extends APIResource {
  getClient(): Keepa {
    return this._client;
  }
}

describe('APIResource', () => {
  it('stores the client passed in the constructor and exposes it to subclasses', () => {
    const client = new Keepa({ apiKey: 'k' });
    const resource = new FakeResource(client);
    expect(resource.getClient()).toBe(client);
  });
});
