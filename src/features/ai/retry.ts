/**
 * Provider-agnostic retry policy. Pure — no I/O, no timers by default (a
 * `sleep` fn can be injected) — so it's fully unit-testable and shared by
 * every outbound AI/transcription call.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * 429 (rate limit) and 5xx are worth a retry. Everything else — 400/401/403,
 * a 404 from a bad/renamed model, or OpenAI's `insufficient_quota` — is a
 * permanent condition; retrying just burns the request timeout for nothing,
 * so fail fast and let the caller fall through to the next provider.
 */
export function isRetryableOpenAiStatus(status: number, body: string): boolean {
  if (status === 429) {
    return !body.includes("insufficient_quota") && !body.includes("credit_balance_exhausted");
  }
  return status >= 500;
}

/** Generic transient-HTTP-status check: 429 (rate limit) or 5xx. Used for any
 * provider without a more specific classification (AssemblyAI, Gemini, ...). */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isRetryableGeminiStatus(status: number): boolean {
  return isRetryableHttpStatus(status);
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retries `attempt` while `shouldRetry(error)` is true, with exponential backoff. */
export async function withRetries<T>(
  attempt: (attemptNumber: number) => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await attempt(i);
    } catch (e) {
      lastError = e;
      if (i === maxAttempts || !shouldRetry(e)) throw e;
      await sleep(baseDelayMs * 2 ** (i - 1));
    }
  }
  throw lastError;
}
