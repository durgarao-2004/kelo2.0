import { describe, it, expect } from "vitest";
import { exceedsGroqWhisperLimit, clipForAnalysis, GROQ_WHISPER_MAX_BYTES } from "./limits";

describe("exceedsGroqWhisperLimit", () => {
  it("allows files at or under the 25MB cap", () => {
    expect(exceedsGroqWhisperLimit(GROQ_WHISPER_MAX_BYTES)).toBe(false);
    expect(exceedsGroqWhisperLimit(1024)).toBe(false);
  });

  it("rejects files over the cap (a long lecture on the fallback provider)", () => {
    expect(exceedsGroqWhisperLimit(GROQ_WHISPER_MAX_BYTES + 1)).toBe(true);
  });
});

describe("clipForAnalysis", () => {
  it("leaves a normal lecture transcript untouched", () => {
    const text = "a".repeat(5000);
    expect(clipForAnalysis(text)).toBe(text);
  });

  it("leaves a transcript exactly at the cap untouched", () => {
    const text = "a".repeat(100_000);
    expect(clipForAnalysis(text, 100_000)).toBe(text);
  });

  it("clips only a genuinely extreme transcript, at a boundary, with a marker", () => {
    const text = "a".repeat(100_010);
    const clipped = clipForAnalysis(text, 100_000);
    expect(clipped.length).toBe(100_001);
    expect(clipped.endsWith("…")).toBe(true);
  });
});
