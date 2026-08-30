import { describe, it, expect } from "vitest";
import { classifyLectureAttention, attentionRank, ATTENTION_STATUSES } from "./lecture-attention";

describe("classifyLectureAttention", () => {
  it("classifies failed/recoverable as actionable", () => {
    expect(classifyLectureAttention("failed")).toBe("action");
    expect(classifyLectureAttention("recoverable")).toBe("action");
  });

  it("classifies in-flight statuses as processing (informational only)", () => {
    expect(classifyLectureAttention("uploading")).toBe("processing");
    expect(classifyLectureAttention("transcribing")).toBe("processing");
    expect(classifyLectureAttention("transcribed")).toBe("processing");
    expect(classifyLectureAttention("analyzing")).toBe("processing");
    expect(classifyLectureAttention("finalizing")).toBe("processing");
  });

  it("returns null for statuses that need no attention", () => {
    expect(classifyLectureAttention("completed")).toBeNull();
    expect(classifyLectureAttention("recording")).toBeNull();
    expect(classifyLectureAttention("uploaded")).toBeNull();
  });
});

describe("attentionRank", () => {
  it("ranks actionable lectures before merely-processing ones", () => {
    expect(attentionRank("failed")).toBeLessThan(attentionRank("transcribing"));
    expect(attentionRank("recoverable")).toBeLessThan(attentionRank("analyzing"));
  });

  it("gives the same rank to lectures within the same category", () => {
    expect(attentionRank("failed")).toBe(attentionRank("recoverable"));
    expect(attentionRank("uploading")).toBe(attentionRank("finalizing"));
  });
});

describe("ATTENTION_STATUSES", () => {
  it("excludes completed/recording/uploaded — no-action-needed states", () => {
    expect(ATTENTION_STATUSES).not.toContain("completed");
    expect(ATTENTION_STATUSES).not.toContain("recording");
    expect(ATTENTION_STATUSES).not.toContain("uploaded");
  });

  it("has no duplicates", () => {
    expect(new Set(ATTENTION_STATUSES).size).toBe(ATTENTION_STATUSES.length);
  });
});
