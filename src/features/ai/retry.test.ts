import { describe, it, expect, vi } from "vitest";
import {
  withRetries,
  isRetryableOpenAiStatus,
  isRetryableGeminiStatus,
  ProviderError,
} from "./retry";

describe("isRetryableOpenAiStatus", () => {
  it("retries plain rate limits", () => {
    expect(isRetryableOpenAiStatus(429, "rate_limit_exceeded")).toBe(true);
  });

  it("does not retry an exhausted quota (retrying can't fix zero balance)", () => {
    expect(isRetryableOpenAiStatus(429, '{"type":"insufficient_quota"}')).toBe(false);
    expect(isRetryableOpenAiStatus(429, '{"code":"credit_balance_exhausted"}')).toBe(false);
  });

  it("retries 5xx", () => {
    expect(isRetryableOpenAiStatus(500, "")).toBe(true);
    expect(isRetryableOpenAiStatus(503, "")).toBe(true);
  });

  it("does not retry 4xx other than 429", () => {
    expect(isRetryableOpenAiStatus(400, "")).toBe(false);
    expect(isRetryableOpenAiStatus(401, "")).toBe(false);
    expect(isRetryableOpenAiStatus(404, "")).toBe(false);
  });
});

describe("isRetryableGeminiStatus", () => {
  it("retries 429 and 5xx", () => {
    expect(isRetryableGeminiStatus(429)).toBe(true);
    expect(isRetryableGeminiStatus(500)).toBe(true);
    expect(isRetryableGeminiStatus(503)).toBe(true);
  });

  it("does not retry 404 (bad/renamed model) or other 4xx", () => {
    expect(isRetryableGeminiStatus(404)).toBe(false);
    expect(isRetryableGeminiStatus(400)).toBe(false);
    expect(isRetryableGeminiStatus(401)).toBe(false);
  });
});

describe("withRetries", () => {
  const noSleep = { sleep: async () => {} };

  it("returns the result on first success without retrying", async () => {
    const attempt = vi.fn(async () => "ok");
    const result = await withRetries(attempt, () => true, noSleep);
    expect(result).toBe("ok");
    expect(attempt).toHaveBeenCalledOnce();
  });

  it("retries a retryable error and eventually succeeds", async () => {
    let calls = 0;
    const attempt = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new ProviderError("transient", true);
      return "recovered";
    });
    const result = await withRetries(attempt, (e) => e instanceof ProviderError && e.retryable, {
      ...noSleep,
      maxAttempts: 3,
    });
    expect(result).toBe("recovered");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("fails fast on a non-retryable error without retrying", async () => {
    const attempt = vi.fn(async () => {
      throw new ProviderError("permanent", false);
    });
    await expect(
      withRetries(attempt, (e) => e instanceof ProviderError && e.retryable, {
        ...noSleep,
        maxAttempts: 3,
      }),
    ).rejects.toThrow("permanent");
    expect(attempt).toHaveBeenCalledOnce();
  });

  it("stops after maxAttempts even if every error is retryable", async () => {
    const attempt = vi.fn(async () => {
      throw new ProviderError("still down", true);
    });
    await expect(
      withRetries(attempt, () => true, { ...noSleep, maxAttempts: 3 }),
    ).rejects.toThrow("still down");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("backs off exponentially between retries", async () => {
    const delays: number[] = [];
    let calls = 0;
    const attempt = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new ProviderError("transient", true);
      return "ok";
    });
    await withRetries(attempt, (e) => e instanceof ProviderError && e.retryable, {
      maxAttempts: 3,
      baseDelayMs: 100,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    expect(delays).toEqual([100, 200]);
  });
});
