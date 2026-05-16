import { APIError, NetworkError } from './error.js';
import { extractRateLimit, type RateLimitInfo } from './rate-limit.js';

export type QueryValue = string | number | string[] | number[] | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface RequestArgs {
  path: string;
  query?: QueryParams;
  context: string;
}

export interface RequestConfig {
  baseURL: string;
  apiKey: string;
  fetch: typeof globalThis.fetch;
  /** Fired once per response (200 or 429) when Keepa's bucket fields are
   *  present on the body. */
  onRateLimit?: (info: RateLimitInfo) => void;
}

export function buildUrl(baseURL: string, path: string, query?: QueryParams): string {
  if (!query) return `${baseURL}${path}`;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    const stringValue = Array.isArray(value) ? value.join(',') : String(value);
    parts.push(`${encodeURIComponent(key)}=${encodeKeepaValue(stringValue)}`);
  }
  return parts.length ? `${baseURL}${path}?${parts.join('&')}` : `${baseURL}${path}`;
}

// Keep commas literal — Keepa's category endpoint rejects %2C-encoded commas
// in comma-separated lists (asin=A,B,C, category=1,2,3).
function encodeKeepaValue(value: string): string {
  return encodeURIComponent(value).replace(/%2C/g, ',');
}

export async function request<T>(config: RequestConfig, args: RequestArgs): Promise<T> {
  const query: QueryParams = { key: config.apiKey, ...args.query };
  const url = buildUrl(config.baseURL, args.path, query);
  let res: Response;
  try {
    res = await config.fetch(url);
  } catch (cause) {
    throw new NetworkError(args.context, cause);
  }

  // Read the body once — Response bodies are single-use streams, and we need
  // the same payload for both rate-limit extraction and (on errors) the body
  // attached to the thrown error.
  const text = await res.text().catch(() => '');
  const body = safeJsonParse(text);

  const rl = extractRateLimit(body);
  if (rl) config.onRateLimit?.(rl);

  if (!res.ok) throw APIError.from(res.status, args.context, text, rl);
  return body as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
