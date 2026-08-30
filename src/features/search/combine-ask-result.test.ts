import { describe, it, expect } from "vitest";
import { combineAskContext } from "./combine-ask-result";
import type { RetrievedChunk } from "@/server/search/retrieve";
import type { AcademicReferenceHit } from "@/server/search/textbook-concepts";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "c1",
    lectureId: "lec-1",
    source: "transcript",
    content: "The professor discussed net present value.",
    rank: 1,
    lectureTitle: "FM — Week 3",
    recordedAt: "2026-01-01",
    subjectName: "FM",
    ...overrides,
  };
}

function academicHit(overrides: Partial<AcademicReferenceHit> = {}): AcademicReferenceHit {
  return {
    lectureId: "lec-1",
    lectureTitle: "FM — Week 3",
    concept: "Net Present Value",
    citation: "Financial Management — I. M. Pandey, 13th Edition",
    ...overrides,
  };
}

describe("combineAskContext", () => {
  it("happy path: combines chunks and academic references untouched", () => {
    const result = combineAskContext(
      { data: [chunk()], error: null },
      { data: [academicHit()], error: null },
    );
    expect(result.chunks).toHaveLength(1);
    expect(result.academicReferences).toHaveLength(1);
    expect(result.chunksError).toBeNull();
  });

  it("DB/lookup failure on academic references fails open (empty, not an error)", () => {
    const result = combineAskContext(
      { data: [chunk()], error: null },
      { data: [], error: "relation does not exist" },
    );
    expect(result.chunks).toHaveLength(1);
    expect(result.academicReferences).toEqual([]);
    expect(result.chunksError).toBeNull();
  });

  it("a chunks-lookup failure is NOT swallowed — it's the required source", () => {
    const result = combineAskContext(
      { data: [], error: "search_lecture_chunks rpc failed" },
      { data: [academicHit()], error: null },
    );
    expect(result.chunksError).toBe("search_lecture_chunks rpc failed");
  });

  it("empty state: nothing found on either side", () => {
    const result = combineAskContext({ data: [], error: null }, { data: [], error: null });
    expect(result.chunks).toEqual([]);
    expect(result.academicReferences).toEqual([]);
    expect(result.chunksError).toBeNull();
  });

  it("is a pure function — repeated calls with the same input are idempotent", () => {
    const chunksOutcome = { data: [chunk()], error: null };
    const academicOutcome = { data: [academicHit()], error: null };
    const first = combineAskContext(chunksOutcome, academicOutcome);
    const second = combineAskContext(chunksOutcome, academicOutcome);
    expect(second).toEqual(first);
  });

  it("keeps lecture chunks and academic references separate even for the same lecture (no cross-source merging)", () => {
    const result = combineAskContext(
      { data: [chunk({ lectureId: "lec-1" })], error: null },
      { data: [academicHit({ lectureId: "lec-1" })], error: null },
    );
    // Both lists reference the same lecture, but must remain two distinct
    // arrays/objects — never merged into one combined item.
    expect(result.chunks).toHaveLength(1);
    expect(result.academicReferences).toHaveLength(1);
    expect(result.chunks[0]).not.toHaveProperty("citation");
    expect(result.academicReferences[0]).not.toHaveProperty("content");
  });
});
