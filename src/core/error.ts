/** Defense-in-depth — keeps the API key out of error messages even when a
 *  transport error or upstream response echoes the request URL back. */
export function scrubApiKey(text: string): string {
  return text.replace(/([?&])key=[^&\s]*/gi, '$1key=REDACTED');
}

export class KeepaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeepaError';
  }
}

export class APIError extends KeepaError {
  readonly status: number;
  readonly context: string;
  readonly body: string;

  constructor(status: number, context: string, body: string, message?: string) {
    const safeBody = scrubApiKey(body);
    super(scrubApiKey(message ?? `Keepa ${context} error (${status}): ${safeBody}`));
    this.name = 'APIError';
    this.status = status;
    this.context = context;
    this.body = safeBody;
  }

  static async from(response: Response, context: string): Promise<APIError> {
    const body = await response.text().catch(() => '');
    switch (response.status) {
      case 429:
        return new RateLimitError(context, body);
      case 401:
        return new AuthenticationError(context, body);
      default:
        return new APIError(response.status, context, body);
    }
  }
}

export class RateLimitError extends APIError {
  constructor(context: string, body: string) {
    super(429, context, body, 'Keepa rate limit exceeded, please wait or upgrade plan');
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends APIError {
  constructor(context: string, body: string) {
    super(
      401,
      context,
      body,
      `Keepa authentication failed for ${context}: invalid or missing API key`,
    );
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends KeepaError {
  readonly context: string;
  override readonly cause: unknown;

  constructor(context: string, cause: unknown) {
    const raw = cause instanceof Error ? cause.message : String(cause);
    super(`Keepa ${context} network error: ${scrubApiKey(raw)}`);
    this.name = 'NetworkError';
    this.context = context;
    this.cause = cause;
  }
}
