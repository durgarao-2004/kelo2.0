import { describe, it, expect } from "vitest";
import { toUserFacingProcessingError } from "./user-facing";

describe("toUserFacingProcessingError", () => {
  it("returns the standard clean message", () => {
    expect(toUserFacingProcessingError("assemblyai poll 500: <html>...")).toBe(
      "Transcription is temporarily unavailable. Please retry processing.",
    );
  });

  it("never echoes any part of the raw error back to the caller", () => {
    const raw =
      "groq-whisper 401: Authorization Bearer sk-super-secret-leaked-key-12345 invalid";
    const clean = toUserFacingProcessingError(raw);
    expect(clean).not.toContain("sk-super-secret-leaked-key-12345");
    expect(clean).not.toContain("401");
    expect(clean).not.toContain("Bearer");
  });

  it("handles null/undefined/empty input the same way", () => {
    const expected = "Transcription is temporarily unavailable. Please retry processing.";
    expect(toUserFacingProcessingError(null)).toBe(expected);
    expect(toUserFacingProcessingError(undefined)).toBe(expected);
    expect(toUserFacingProcessingError("")).toBe(expected);
  });
});
