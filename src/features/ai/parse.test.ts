import { describe, it, expect } from "vitest";
import { extractJsonObject, asStringArray, asFlashcards } from "./parse";

describe("extractJsonObject", () => {
  it("parses plain JSON", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses fenced JSON", () => {
    expect(extractJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("extracts JSON embedded in prose", () => {
    expect(
      extractJsonObject('Sure! Here it is: {"title":"X"} — hope that helps.'),
    ).toEqual({ title: "X" });
  });
  it("returns null on non-JSON", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });
});

describe("asStringArray", () => {
  it("keeps only non-empty strings", () => {
    expect(asStringArray(["a", "", "  b  ", 3, null])).toEqual(["a", "b"]);
  });
  it("returns [] for non-arrays", () => {
    expect(asStringArray("nope")).toEqual([]);
  });
});

describe("asFlashcards", () => {
  it("keeps well-formed {q,a} items", () => {
    expect(
      asFlashcards([
        { q: "Q1", a: "A1" },
        { q: "bad" },
        { q: "Q2", a: "A2" },
      ]),
    ).toEqual([
      { q: "Q1", a: "A1" },
      { q: "Q2", a: "A2" },
    ]);
  });
});
