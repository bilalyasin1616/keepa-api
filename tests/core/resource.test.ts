import { describe, it, expect } from 'vitest';
import { APIResource } from '../../src/core/resource.js';
import { KeepaClient } from '../../src/client.js';

class FakeResource extends APIResource {
  getClient(): KeepaClient {
    return this._client;
  }
}

describe('APIResource', () => {
  it('stores the client passed in the constructor and exposes it to subclasses', () => {
    const client = new KeepaClient({ apiKey: 'k' });
    const resource = new FakeResource(client);
    expect(resource.getClient()).toBe(client);
  });
});
