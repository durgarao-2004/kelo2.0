import { describe, it, expect, vi } from "vitest";
import {
  interpretAssemblyAiPoll,
  extractUploadUrl,
  extractJobId,
  pollUntilDone,
  transcriptionProviderOrder,
} from "./assemblyai";

describe("interpretAssemblyAiPoll", () => {
  it("recognizes a completed job", () => {
    const result = interpretAssemblyAiPoll({ status: "completed", text: "hello lecture" });
    expect(result).toEqual({ kind: "completed", text: "hello lecture" });
  });

  it("treats a completed job with no text as an empty transcript, not a crash", () => {
    const result = interpretAssemblyAiPoll({ status: "completed" });
    expect(result).toEqual({ kind: "completed", text: "" });
  });

  it("recognizes a failed job and surfaces the provider's message", () => {
    const result = interpretAssemblyAiPoll({ status: "error", error: "invalid audio format" });
    expect(result).toEqual({ kind: "failed", message: "invalid audio format" });
  });

  it("falls back to a generic message when a failed job has no error text", () => {
    const result = interpretAssemblyAiPoll({ status: "error" });
    expect(result).toEqual({ kind: "failed", message: "unknown error" });
  });

  it("treats queued/processing/unknown statuses as still processing", () => {
    expect(interpretAssemblyAiPoll({ status: "queued" })).toEqual({ kind: "processing" });
    expect(interpretAssemblyAiPoll({ status: "processing" })).toEqual({ kind: "processing" });
    expect(interpretAssemblyAiPoll({})).toEqual({ kind: "processing" });
  });
});

describe("extractUploadUrl / extractJobId", () => {
  it("returns the value when present", () => {
    expect(extractUploadUrl({ upload_url: "https://cdn.assemblyai.com/x" })).toBe(
      "https://cdn.assemblyai.com/x",
    );
    expect(extractJobId({ id: "job-123" })).toBe("job-123");
  });

  it("throws on a malformed response missing the expected field", () => {
    expect(() => extractUploadUrl({})).toThrow(/malformed response/);
    expect(() => extractJobId({})).toThrow(/malformed response/);
  });
});

describe("pollUntilDone", () => {
  const noSleep = { sleep: async () => {} };

  it("returns the transcript once the job completes", async () => {
    let calls = 0;
    const poll = vi.fn(async () => {
      calls++;
      if (calls < 3) return { status: "processing" };
      return { status: "completed", text: "final transcript" };
    });
    const text = await pollUntilDone(poll, { intervalMs: 10, timeoutMs: 10_000, ...noSleep });
    expect(text).toBe("final transcript");
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("throws immediately when the job reports an error status", async () => {
    const poll = vi.fn(async () => ({ status: "error", error: "corrupt audio" }));
    await expect(
      pollUntilDone(poll, { intervalMs: 10, timeoutMs: 10_000, ...noSleep }),
    ).rejects.toThrow(/corrupt audio/);
    expect(poll).toHaveBeenCalledOnce();
  });

  it("times out if the job never completes within timeoutMs", async () => {
    const poll = vi.fn(async () => ({ status: "processing" }));
    let t = 0;
    const now = () => t;
    const sleep = async (ms: number) => {
      t += ms;
    };
    await expect(
      pollUntilDone(poll, { intervalMs: 1_000, timeoutMs: 5_000, now, sleep }),
    ).rejects.toThrow(/timed out/);
    // Never resolves as success, and stops polling once the deadline passes.
    expect(poll.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("transcriptionProviderOrder", () => {
  it("prefers AssemblyAI, then Groq Whisper", () => {
    expect(transcriptionProviderOrder({ assemblyai: true, groq: true })).toEqual([
      "assemblyai",
      "groq-whisper",
    ]);
  });

  it("falls back to Groq alone when AssemblyAI isn't configured", () => {
    expect(transcriptionProviderOrder({ assemblyai: false, groq: true })).toEqual([
      "groq-whisper",
    ]);
  });

  it("uses AssemblyAI alone when Groq isn't configured", () => {
    expect(transcriptionProviderOrder({ assemblyai: true, groq: false })).toEqual([
      "assemblyai",
    ]);
  });

  it("returns an empty order when nothing is configured", () => {
    expect(transcriptionProviderOrder({ assemblyai: false, groq: false })).toEqual([]);
  });
});
