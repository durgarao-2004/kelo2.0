import { describe, it, expect } from "vitest";
import { findMissingChunkIndexes } from "./chunk-gaps";

describe("findMissingChunkIndexes", () => {
  it("reports nothing missing when every index is present", () => {
    expect(findMissingChunkIndexes([0, 1, 2, 3], 4)).toEqual([]);
  });

  it("finds a gap in the middle", () => {
    expect(findMissingChunkIndexes([0, 1, 3], 4)).toEqual([2]);
  });

  it("finds a missing tail (upload stopped partway through)", () => {
    expect(findMissingChunkIndexes([0, 1], 5)).toEqual([2, 3, 4]);
  });

  it("finds a missing head", () => {
    expect(findMissingChunkIndexes([1, 2, 3], 4)).toEqual([0]);
  });

  it("is unaffected by input order", () => {
    expect(findMissingChunkIndexes([3, 0, 1], 4)).toEqual([2]);
  });

  it("treats an empty expectation as complete", () => {
    expect(findMissingChunkIndexes([], 0)).toEqual([]);
  });

  it("reports everything missing when nothing is present", () => {
    expect(findMissingChunkIndexes([], 3)).toEqual([0, 1, 2]);
  });

  it("ignores duplicate present indexes", () => {
    expect(findMissingChunkIndexes([0, 0, 1, 1], 3)).toEqual([2]);
  });
});
