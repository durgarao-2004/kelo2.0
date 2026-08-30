import { classStatus, type TimeSlot } from "@/features/timetable/overlap";

/**
 * Pure decision logic for the two new dashboard notification triggers.
 * Kept separate from localStorage/Notification-API glue (see
 * components/dashboard/dashboard-notifier.tsx) so the actual "should this
 * fire" decision is directly unit-testable without a DOM.
 *
 * IMPORTANT LIMITATION: these only fire while the dashboard is open in a
 * browser tab — this is client-side polling, not push. A class reminder
 * while the phone is asleep or the tab is closed needs real Web Push
 * (VAPID keys + a subscriptions table + a server-side scheduler), which
 * this stack doesn't have. See notify.ts's own doc comment.
 */

export interface ClassCandidate extends TimeSlot {
  id: string;
  subjectName: string;
  location: string | null;
}

/** Classes today that just entered their "starting soon" window and haven't
 * already been notified about today. */
export function findClassesStartingSoon(
  todaysClasses: ClassCandidate[],
  nowMinute: number,
  alreadyNotifiedIds: ReadonlySet<string>,
): ClassCandidate[] {
  return todaysClasses.filter(
    (c) =>
      classStatus(c.start_minute, c.end_minute, nowMinute) === "starting_soon" &&
      !alreadyNotifiedIds.has(classNotificationId(c.id)),
  );
}

export function classNotificationId(scheduleEntryId: string): string {
  return `class-${scheduleEntryId}`;
}

export interface AttendanceRiskCandidate {
  subjectId: string;
  subjectName: string;
  percentage: number | null;
  requiredPercent: number;
  status: "safe" | "warning" | "no_data";
}

/** Subjects currently below their required attendance threshold that
 * haven't already been notified about today. */
export function findAttendanceAtRisk(
  subjects: AttendanceRiskCandidate[],
  alreadyNotifiedIds: ReadonlySet<string>,
): AttendanceRiskCandidate[] {
  return subjects.filter(
    (s) => s.status === "warning" && !alreadyNotifiedIds.has(attendanceNotificationId(s.subjectId)),
  );
}

export function attendanceNotificationId(subjectId: string): string {
  return `attendance-${subjectId}`;
}
