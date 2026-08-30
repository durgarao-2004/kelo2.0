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
  /** How many more classes can be missed and still stay >= required. Bounded
   * by `remaining` when `totalSessions` is known — you can never safely miss
   * more classes than are actually left in the term. */
  safeSkips: number | null;
  /** How many consecutive classes must be attended to reach required. */
  classesToTarget: number | null;
  /** Total planned sessions for the term, if known. */
  totalSessions: number | null;
  /** totalSessions - conducted, clamped to >= 0. Null when totalSessions is unknown. */
  remaining: number | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeAttendance(input: {
  attended: number;
  missed: number;
  cancelled?: number;
  requiredPercent: number;
  /** Total planned sessions for the term, if known. Used to bound safeSkips
   * and compute `remaining`; never required for the core percentage math. */
  totalSessions?: number | null;
}): AttendanceStats {
  const attended = Math.max(0, Math.floor(input.attended));
  const missed = Math.max(0, Math.floor(input.missed));
  const cancelled = Math.max(0, Math.floor(input.cancelled ?? 0));
  const required = Math.max(0, Math.min(100, input.requiredPercent));
  const conducted = attended + missed;
  const totalSessions =
    input.totalSessions != null && input.totalSessions > 0
      ? Math.floor(input.totalSessions)
      : null;
  const remaining = totalSessions !== null ? Math.max(0, totalSessions - conducted) : null;

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
      totalSessions,
      remaining,
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
    // Can never safely miss more classes than are actually left in the term.
    if (remaining !== null) safeSkips = Math.min(safeSkips, remaining);
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
    totalSessions,
    remaining,
  };
}

export function computeAttendanceFromRecords(
  records: Array<{ status: AttendanceRecordStatus }>,
  requiredPercent: number,
  totalSessions?: number | null,
): AttendanceStats {
  let attended = 0;
  let missed = 0;
  let cancelled = 0;
  for (const r of records) {
    if (r.status === "attended") attended++;
    else if (r.status === "missed") missed++;
    else cancelled++;
  }
  return computeAttendance({ attended, missed, cancelled, requiredPercent, totalSessions });
}

/** Aggregate several subjects' stats into one overall figure. */
export function overallAttendance(
  perSubject: Array<Pick<AttendanceStats, "attended" | "conducted">>,
  requiredPercent: number,
  totalSessions?: number | null,
): AttendanceStats {
  const attended = perSubject.reduce((s, x) => s + x.attended, 0);
  const conducted = perSubject.reduce((s, x) => s + x.conducted, 0);
  const missed = conducted - attended;
  return computeAttendance({ attended, missed, requiredPercent, totalSessions });
}

/**
 * Would writing `nextStatus` at one attendance slot push a subject's
 * conducted-session count past its planned total? `conductedExcludingThisSlot`
 * must already exclude whatever record currently occupies that exact slot
 * (same subject/date/schedule-entry) — see server/db/attendance.ts for how
 * that's computed against the DB.
 */
export function validateAttendanceMutation(input: {
  conductedExcludingThisSlot: number;
  nextStatus: AttendanceRecordStatus;
  totalSessions: number;
}): { ok: true } | { ok: false; error: string } {
  const addsOne = input.nextStatus !== "cancelled" ? 1 : 0;
  const prospective = input.conductedExcludingThisSlot + addsOne;
  if (prospective > input.totalSessions) {
    return {
      ok: false,
      error: `Sessions conducted would be ${prospective}, which exceeds the total of ${input.totalSessions} for this subject.`,
    };
  }
  return { ok: true };
}
