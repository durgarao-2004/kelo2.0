/**
 * Upload with retry + exponential backoff — pure and testable via an injected
 * uploader and sleep function. Used to make recording uploads resilient
 * (transient network failures) without ever reporting a false success.
 */
export interface UploadResult {
  ok: boolean;
  attempts: number;
  error?: string;
}

export interface RetryOptions {
  retries?: number; // additional attempts after the first
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onAttempt?: (attempt: number) => void;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function uploadWithRetry(
  upload: () => Promise<void>,
  options: RetryOptions = {},
): Promise<UploadResult> {
  const retries = Math.max(0, options.retries ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 800;
  const sleep = options.sleep ?? defaultSleep;

  let lastError = "Upload failed.";
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    options.onAttempt?.(attempt);
    try {
      await upload();
      return { ok: true, attempts: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Upload failed.";
      if (attempt <= retries) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  return { ok: false, attempts: retries + 1, error: lastError };
}
