import { describe, it, expect } from "vitest";
import {
  computeAttendance,
  computeAttendanceFromRecords,
  overallAttendance,
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
