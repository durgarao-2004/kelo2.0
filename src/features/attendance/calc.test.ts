import { describe, it, expect } from "vitest";
import {
  computeAttendance,
  computeAttendanceFromRecords,
  overallAttendance,
  validateAttendanceMutation,
} from "./calc";

describe("computeAttendance", () => {
  it("matches the spec example (27/33, required 75 → safe, 3 safe skips)", () => {
    const s = computeAttendance({ attended: 27, missed: 6, requiredPercent: 75 });
    expect(s.conducted).toBe(33);
    expect(s.percentage).toBe(81.8);
    expect(s.status).toBe("safe");
    expect(s.safeSkips).toBe(3);
    expect(s.classesToTarget).toBe(0);
  });

  it("excludes cancelled classes from the denominator", () => {
    const s = computeAttendance({
      attended: 8,
      missed: 2,
      cancelled: 5,
      requiredPercent: 75,
    });
    expect(s.conducted).toBe(10);
    expect(s.percentage).toBe(80);
    expect(s.cancelled).toBe(5);
  });

  it("reports no_data when nothing has been conducted", () => {
    const s = computeAttendance({ attended: 0, missed: 0, requiredPercent: 75 });
    expect(s.status).toBe("no_data");
    expect(s.percentage).toBeNull();
    expect(s.safeSkips).toBeNull();
    expect(s.classesToTarget).toBeNull();
  });

  it("computes classes-to-target when below required", () => {
    const s = computeAttendance({ attended: 6, missed: 4, requiredPercent: 75 });
    expect(s.percentage).toBe(60);
    expect(s.status).toBe("warning");
    expect(s.safeSkips).toBe(0);
    expect(s.classesToTarget).toBe(6); // (6+6)/(10+6) = 75%
  });

  it("safeSkips keeps you exactly at the threshold", () => {
    const s = computeAttendance({ attended: 30, missed: 0, requiredPercent: 75 });
    // floor(30*100/75) - 30 = 40 - 30 = 10
    expect(s.safeSkips).toBe(10);
    const after = computeAttendance({
      attended: 30,
      missed: 10,
      requiredPercent: 75,
    });
    expect(after.percentage).toBe(75);
    expect(after.status).toBe("safe");
    expect(after.safeSkips).toBe(0);
  });

  it("exactly meeting required counts as safe", () => {
    const s = computeAttendance({ attended: 3, missed: 1, requiredPercent: 75 });
    expect(s.percentage).toBe(75);
    expect(s.status).toBe("safe");
  });

  it("handles required=100 (never reachable once you have missed)", () => {
    const s = computeAttendance({ attended: 9, missed: 1, requiredPercent: 100 });
    expect(s.status).toBe("warning");
    expect(s.classesToTarget).toBeNull(); // Infinity → null
  });

  it("clamps negative inputs", () => {
    const s = computeAttendance({ attended: -5, missed: -2, requiredPercent: 75 });
    expect(s.status).toBe("no_data");
  });
});

describe("computeAttendance with totalSessions", () => {
  it("reports remaining sessions and leaves totalSessions/remaining null when unknown", () => {
    const withTotal = computeAttendance({
      attended: 20,
      missed: 5,
      requiredPercent: 75,
      totalSessions: 33,
    });
    expect(withTotal.totalSessions).toBe(33);
    expect(withTotal.remaining).toBe(8); // 33 - 25

    const withoutTotal = computeAttendance({ attended: 20, missed: 5, requiredPercent: 75 });
    expect(withoutTotal.totalSessions).toBeNull();
    expect(withoutTotal.remaining).toBeNull();
  });

  it("clamps remaining to 0 rather than going negative when conducted exceeds total", () => {
    const s = computeAttendance({
      attended: 30,
      missed: 10,
      requiredPercent: 75,
      totalSessions: 33,
    });
    expect(s.conducted).toBe(40);
    expect(s.remaining).toBe(0);
  });

  it("bounds safeSkips by the sessions actually remaining in the term", () => {
    // Attended is far ahead of target, so the raw safeSkips formula would
    // allow skipping many more classes than the term even has left.
    const s = computeAttendance({
      attended: 30,
      missed: 0,
      requiredPercent: 50,
      totalSessions: 33,
    });
    // Raw formula: floor(30*100/50) - 30 = 30, but only 3 sessions remain.
    expect(s.remaining).toBe(3);
    expect(s.safeSkips).toBe(3);
  });

  it("ignores a non-positive totalSessions as unknown", () => {
    const s = computeAttendance({ attended: 5, missed: 1, requiredPercent: 75, totalSessions: 0 });
    expect(s.totalSessions).toBeNull();
    expect(s.remaining).toBeNull();
  });
});

describe("validateAttendanceMutation", () => {
  it("allows a mark that stays within the total", () => {
    expect(
      validateAttendanceMutation({
        conductedExcludingThisSlot: 10,
        nextStatus: "attended",
        totalSessions: 33,
      }),
    ).toEqual({ ok: true });
  });

  it("allows exactly reaching the total (boundary)", () => {
    expect(
      validateAttendanceMutation({
        conductedExcludingThisSlot: 32,
        nextStatus: "missed",
        totalSessions: 33,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a mark that would push conducted past the total", () => {
    const result = validateAttendanceMutation({
      conductedExcludingThisSlot: 33,
      nextStatus: "attended",
      totalSessions: 33,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/exceeds the total/);
  });

  it("never rejects marking a slot cancelled, since cancelled doesn't count as conducted", () => {
    expect(
      validateAttendanceMutation({
        conductedExcludingThisSlot: 33,
        nextStatus: "cancelled",
        totalSessions: 33,
      }),
    ).toEqual({ ok: true });
  });
});

describe("computeAttendanceFromRecords", () => {
  it("tallies statuses", () => {
    const s = computeAttendanceFromRecords(
      [
        { status: "attended" },
        { status: "attended" },
        { status: "missed" },
        { status: "cancelled" },
      ],
      50,
    );
    expect(s.attended).toBe(2);
    expect(s.missed).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.conducted).toBe(3);
  });
});

describe("overallAttendance", () => {
  it("aggregates across subjects", () => {
    const s = overallAttendance(
      [
        { attended: 27, conducted: 33 },
        { attended: 10, conducted: 20 },
      ],
      75,
    );
    expect(s.attended).toBe(37);
    expect(s.conducted).toBe(53);
    expect(s.percentage).toBe(69.8);
    expect(s.status).toBe("warning");
  });
});
