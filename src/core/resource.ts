import type { Keepa } from '../client.js';

export abstract class APIResource {
  protected _client: Keepa;

  constructor(client: Keepa) {
    this._client = client;
  }
}
