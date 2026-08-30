import { describe, it, expect } from "vitest";
import { cleanTranscript } from "./transcript-clean";

describe("cleanTranscript", () => {
  it("collapses runs of spaces/tabs without touching words", () => {
    expect(cleanTranscript("hello    world\tfoo")).toBe("hello world foo");
  });

  it("trims trailing/leading whitespace per line and overall", () => {
    expect(cleanTranscript("  line one  \n  line two  ")).toBe("line one\nline two");
  });

  it("normalizes CRLF to LF", () => {
    expect(cleanTranscript("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("collapses 3+ blank lines down to one blank line", () => {
    expect(cleanTranscript("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("strips non-printable control characters but keeps newlines and tabs", () => {
    const withControlChars = `hello${String.fromCharCode(0)}${String.fromCharCode(7)} world`;
    expect(cleanTranscript(withControlChars)).toBe("hello world");
  });

  it("never alters actual spoken words, fillers, or punctuation", () => {
    const input = "um, so basically the algorithm is O(n log n), right?";
    expect(cleanTranscript(input)).toBe(input);
  });

  it("returns an empty string for blank input", () => {
    expect(cleanTranscript("   \n\n  ")).toBe("");
  });
});
