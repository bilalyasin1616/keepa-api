import { APIError, NetworkError } from './error.js';

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
  if (!res.ok) throw await APIError.from(res, args.context);
  return (await res.json()) as T;
}
