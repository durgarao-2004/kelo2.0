import { describe, it, expect } from "vitest";
import {
  extractJsonObject,
  asStringArray,
  asFlashcards,
  asDefinitions,
  asNoteSections,
} from "./parse";

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

describe("asDefinitions", () => {
  it("keeps well-formed {term,definition} items", () => {
    expect(
      asDefinitions([
        { term: "Entropy", definition: "A measure of disorder." },
        { term: "bad" },
        { term: "  Latency ", definition: " time delay " },
      ]),
    ).toEqual([
      { term: "Entropy", definition: "A measure of disorder." },
      { term: "Latency", definition: "time delay" },
    ]);
  });

  it("drops entries with blank term or definition", () => {
    expect(asDefinitions([{ term: "", definition: "x" }, { term: "x", definition: "" }])).toEqual(
      [],
    );
  });

  it("returns [] for a malformed (non-array) response", () => {
    expect(asDefinitions("not an array")).toEqual([]);
    expect(asDefinitions(null)).toEqual([]);
    expect(asDefinitions(undefined)).toEqual([]);
  });
});

describe("asNoteSections", () => {
  it("keeps sections with a heading and at least one point", () => {
    expect(
      asNoteSections([
        { heading: "Intro", points: ["a", "b"] },
        { heading: "", points: ["dropped: no heading"] },
        { heading: "Empty section", points: [] },
        { heading: "Recap", points: ["c"] },
      ]),
    ).toEqual([
      { heading: "Intro", points: ["a", "b"] },
      { heading: "Recap", points: ["c"] },
    ]);
  });

  it("returns [] for malformed input", () => {
    expect(asNoteSections("nope")).toEqual([]);
    expect(asNoteSections([{ heading: "X" }])).toEqual([]);
  });
});
