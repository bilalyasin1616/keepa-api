import type { KeepaClient } from '../client.js';

export abstract class APIResource {
  protected _client: KeepaClient;

  constructor(client: KeepaClient) {
    this._client = client;
  }
}
