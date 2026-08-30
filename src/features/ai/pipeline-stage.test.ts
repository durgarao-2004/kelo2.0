import { describe, it, expect } from "vitest";
import { resumeStage, canClaim, claimStatusFor } from "./pipeline-stage";

describe("resumeStage", () => {
  it("resumes at transcribe when there's no transcript yet", () => {
    expect(resumeStage(false, false)).toBe("transcribe");
    expect(resumeStage(false, true)).toBe("transcribe");
  });

  it("resumes at analyze when the transcript exists but not the summary", () => {
    expect(resumeStage(true, false)).toBe("analyze");
  });

  it("resumes at finalize when both already exist", () => {
    expect(resumeStage(true, true)).toBe("finalize");
  });
});

describe("claimStatusFor", () => {
  it("maps each stage to its in-flight status", () => {
    expect(claimStatusFor("transcribe")).toBe("transcribing");
    expect(claimStatusFor("analyze")).toBe("analyzing");
    expect(claimStatusFor("finalize")).toBe("finalizing");
  });
});

describe("canClaim", () => {
  const STALE_MS = 10 * 60 * 1000;
  const now = 1_000_000_000;

  it("allows claiming a lecture that's not in flight", () => {
    expect(canClaim("uploaded", now - 1000, now, STALE_MS)).toBe(true);
    expect(canClaim("recoverable", now - 1000, now, STALE_MS)).toBe(true);
    expect(canClaim("completed", now - 1000, now, STALE_MS)).toBe(true);
  });

  it("refuses a genuinely in-flight, recently-updated run (prevents duplicate processing)", () => {
    expect(canClaim("transcribing", now - 1000, now, STALE_MS)).toBe(false);
    expect(canClaim("analyzing", now - 5000, now, STALE_MS)).toBe(false);
    expect(canClaim("finalizing", now - 5000, now, STALE_MS)).toBe(false);
  });

  it("allows reclaiming a stale in-flight run (recovers from a crashed process)", () => {
    expect(canClaim("transcribing", now - STALE_MS - 1, now, STALE_MS)).toBe(true);
  });

  it("treats exactly the stale boundary as still in flight", () => {
    expect(canClaim("analyzing", now - STALE_MS, now, STALE_MS)).toBe(false);
  });
});
