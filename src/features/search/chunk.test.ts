import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("    ")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    const chunks = chunkText("A short lecture note. Just two sentences.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
  });

  it("splits long text into multiple sequential chunks within the size cap", () => {
    const sentence = "This is a sentence about neural networks and gradients. ";
    const text = sentence.repeat(80); // well over one window
    const chunks = chunkText(text, { maxChars: 500, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.content.length).toBeLessThanOrEqual(560); // maxChars + overlap slack
      expect(c.content.trim().length).toBeGreaterThan(0);
    });
  });

  it("hard-splits a single oversized sentence", () => {
    const huge = "x".repeat(3000);
    const chunks = chunkText(huge, { maxChars: 1000, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].content.length).toBeLessThanOrEqual(1000);
  });

  it("applies overlap between consecutive chunks", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i}.`).join(" ");
    const chunks = chunkText(text, { maxChars: 200, overlapChars: 40 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
