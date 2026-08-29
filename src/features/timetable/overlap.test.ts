import { describe, it, expect } from "vitest";
import {
  validateSlot,
  slotsOverlap,
  findOverlaps,
  conflictsWithExisting,
  classStatus,
  nextClassToday,
} from "./overlap";

const slot = (day: number, start: number, end: number, id?: string) => ({
  id,
  day_of_week: day,
  start_minute: start,
  end_minute: end,
});

describe("validateSlot", () => {
  it("accepts a valid slot", () => {
    expect(validateSlot(slot(1, 600, 660)).valid).toBe(true);
  });
  it("rejects bad day, inverted or out-of-range times", () => {
    expect(validateSlot(slot(7, 600, 660)).valid).toBe(false);
    expect(validateSlot(slot(1, 660, 600)).valid).toBe(false);
    expect(validateSlot(slot(1, 600, 600)).valid).toBe(false);
    expect(validateSlot(slot(1, -1, 660)).valid).toBe(false);
    expect(validateSlot(slot(1, 600, 1441)).valid).toBe(false);
  });
});

describe("slotsOverlap", () => {
  it("is false on different days", () => {
    expect(slotsOverlap(slot(1, 600, 660), slot(2, 600, 660))).toBe(false);
  });
  it("detects intersecting intervals", () => {
    expect(slotsOverlap(slot(1, 600, 700), slot(1, 650, 750))).toBe(true);
  });
  it("treats touching edges as non-overlapping (half-open)", () => {
    expect(slotsOverlap(slot(1, 600, 660), slot(1, 660, 720))).toBe(false);
  });
  it("detects full containment", () => {
    expect(slotsOverlap(slot(1, 600, 800), slot(1, 650, 700))).toBe(true);
  });
});

describe("findOverlaps", () => {
  it("returns each overlapping pair once", () => {
    const slots = [
      slot(1, 600, 660, "a"),
      slot(1, 630, 690, "b"),
      slot(1, 700, 760, "c"),
      slot(2, 600, 660, "d"),
    ];
    const pairs = findOverlaps(slots);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].map((s) => s.id).sort()).toEqual(["a", "b"]);
  });
});

describe("conflictsWithExisting", () => {
  const existing = [slot(1, 600, 660, "a"), slot(3, 540, 600, "b")];
  it("flags a conflicting candidate", () => {
    expect(conflictsWithExisting(slot(1, 640, 700), existing)).toBe(true);
  });
  it("passes a non-conflicting candidate", () => {
    expect(conflictsWithExisting(slot(1, 660, 720), existing)).toBe(false);
  });
  it("ignores the slot's own id when editing", () => {
    const edited = slot(1, 610, 650, "a");
    expect(conflictsWithExisting(edited, existing)).toBe(true);
    expect(conflictsWithExisting(edited, existing, "a")).toBe(false);
  });
});

describe("classStatus", () => {
  it("classifies the timeline correctly", () => {
    expect(classStatus(600, 660, 500)).toBe("upcoming");
    expect(classStatus(600, 660, 590)).toBe("starting_soon");
    expect(classStatus(600, 660, 600)).toBe("in_progress");
    expect(classStatus(600, 660, 630)).toBe("in_progress");
    expect(classStatus(600, 660, 660)).toBe("completed");
    expect(classStatus(600, 660, 700)).toBe("completed");
  });
});

describe("nextClassToday", () => {
  it("returns the earliest not-yet-finished class", () => {
    const slots = [slot(1, 540, 600, "early"), slot(1, 660, 720, "later")];
    expect(nextClassToday(slots, 610)?.id).toBe("later");
    expect(nextClassToday(slots, 500)?.id).toBe("early");
    expect(nextClassToday(slots, 800)).toBeNull();
  });
});
