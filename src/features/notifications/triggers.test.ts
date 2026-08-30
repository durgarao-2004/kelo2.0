import { describe, it, expect } from "vitest";
import {
  findClassesStartingSoon,
  findAttendanceAtRisk,
  classNotificationId,
  attendanceNotificationId,
  type ClassCandidate,
  type AttendanceRiskCandidate,
} from "./triggers";

function cls(overrides: Partial<ClassCandidate> = {}): ClassCandidate {
  return {
    id: "c1",
    day_of_week: 1,
    start_minute: 600, // 10:00
    end_minute: 660,
    subjectName: "FM",
    location: "Room 1",
    ...overrides,
  };
}

describe("findClassesStartingSoon", () => {
  it("fires for a class within the starting-soon window", () => {
    const result = findClassesStartingSoon([cls()], 590, new Set());
    expect(result).toHaveLength(1);
  });

  it("does not fire for a class that already started long ago", () => {
    const result = findClassesStartingSoon([cls()], 620, new Set());
    expect(result).toHaveLength(0);
  });

  it("does not fire for a class far in the future", () => {
    const result = findClassesStartingSoon([cls()], 400, new Set());
    expect(result).toHaveLength(0);
  });

  it("does not re-fire once already notified today (dedup)", () => {
    const result = findClassesStartingSoon([cls()], 590, new Set([classNotificationId("c1")]));
    expect(result).toHaveLength(0);
  });

  it("handles an empty schedule", () => {
    expect(findClassesStartingSoon([], 590, new Set())).toEqual([]);
  });

  it("evaluates each class independently", () => {
    const soon = cls({ id: "a", start_minute: 600 });
    const later = cls({ id: "b", start_minute: 900 });
    const result = findClassesStartingSoon([soon, later], 590, new Set());
    expect(result.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("findAttendanceAtRisk", () => {
  function subject(overrides: Partial<AttendanceRiskCandidate> = {}): AttendanceRiskCandidate {
    return {
      subjectId: "s1",
      subjectName: "FM",
      percentage: 60,
      requiredPercent: 75,
      status: "warning",
      ...overrides,
    };
  }

  it("fires for a subject below its required threshold", () => {
    expect(findAttendanceAtRisk([subject()], new Set())).toHaveLength(1);
  });

  it("does not fire for a subject that's safe", () => {
    expect(findAttendanceAtRisk([subject({ status: "safe" })], new Set())).toHaveLength(0);
  });

  it("does not fire for a subject with no data yet", () => {
    expect(
      findAttendanceAtRisk([subject({ status: "no_data", percentage: null })], new Set()),
    ).toHaveLength(0);
  });

  it("does not re-fire once already notified today (dedup)", () => {
    const result = findAttendanceAtRisk([subject()], new Set([attendanceNotificationId("s1")]));
    expect(result).toHaveLength(0);
  });

  it("handles an empty subject list", () => {
    expect(findAttendanceAtRisk([], new Set())).toEqual([]);
  });
});
