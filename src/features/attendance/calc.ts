/**
 * Attendance calculations — pure, exhaustively testable.
 *
 * Conducted classes = attended + missed. Cancelled classes never count toward
 * the denominator. All the "safe to skip" / "classes to target" numbers derive
 * from the current attended/conducted counts and the subject's required %.
 */
export type AttendanceRecordStatus = "attended" | "missed" | "cancelled";

export interface AttendanceStats {
  attended: number;
  missed: number;
  cancelled: number;
  conducted: number;
  /** 0..100, rounded to 1 dp, or null when nothing has been conducted. */
  percentage: number | null;
  requiredPercent: number;
  status: "safe" | "warning" | "no_data";
  /** How many more classes can be missed and still stay >= required. */
  safeSkips: number | null;
  /** How many consecutive classes must be attended to reach required. */
  classesToTarget: number | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeAttendance(input: {
  attended: number;
  missed: number;
  cancelled?: number;
  requiredPercent: number;
}): AttendanceStats {
  const attended = Math.max(0, Math.floor(input.attended));
  const missed = Math.max(0, Math.floor(input.missed));
  const cancelled = Math.max(0, Math.floor(input.cancelled ?? 0));
  const required = Math.max(0, Math.min(100, input.requiredPercent));
  const conducted = attended + missed;

  if (conducted === 0) {
    return {
      attended,
      missed,
      cancelled,
      conducted,
      percentage: null,
      requiredPercent: required,
      status: "no_data",
      safeSkips: null,
      classesToTarget: null,
    };
  }

  const percentage = round1((attended / conducted) * 100);
  const meetsTarget = attended * 100 >= required * conducted;

  let safeSkips: number;
  let classesToTarget: number;

  if (meetsTarget) {
    // Max k such that attended / (conducted + k) >= required/100.
    safeSkips =
      required === 0
        ? Number.POSITIVE_INFINITY
        : Math.max(0, Math.floor((attended * 100) / required) - conducted);
    classesToTarget = 0;
  } else {
    safeSkips = 0;
    // Min n such that (attended + n) / (conducted + n) >= required/100.
    classesToTarget =
      required >= 100
        ? Number.POSITIVE_INFINITY
        : Math.ceil(
            (required * conducted - 100 * attended) / (100 - required),
          );
  }

  return {
    attended,
    missed,
    cancelled,
    conducted,
    percentage,
    requiredPercent: required,
    status: meetsTarget ? "safe" : "warning",
    safeSkips: Number.isFinite(safeSkips) ? safeSkips : null,
    classesToTarget: Number.isFinite(classesToTarget) ? classesToTarget : null,
  };
}

export function computeAttendanceFromRecords(
  records: Array<{ status: AttendanceRecordStatus }>,
  requiredPercent: number,
): AttendanceStats {
  let attended = 0;
  let missed = 0;
  let cancelled = 0;
  for (const r of records) {
    if (r.status === "attended") attended++;
    else if (r.status === "missed") missed++;
    else cancelled++;
  }
  return computeAttendance({ attended, missed, cancelled, requiredPercent });
}

/** Aggregate several subjects' stats into one overall figure. */
export function overallAttendance(
  perSubject: Array<Pick<AttendanceStats, "attended" | "conducted">>,
  requiredPercent: number,
): AttendanceStats {
  const attended = perSubject.reduce((s, x) => s + x.attended, 0);
  const conducted = perSubject.reduce((s, x) => s + x.conducted, 0);
  const missed = conducted - attended;
  return computeAttendance({ attended, missed, requiredPercent });
}
