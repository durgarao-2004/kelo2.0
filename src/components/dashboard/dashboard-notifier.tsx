"use client";

import * as React from "react";
import {
  findClassesStartingSoon,
  findAttendanceAtRisk,
  classNotificationId,
  attendanceNotificationId,
  type ClassCandidate,
} from "@/features/notifications/triggers";
import { notify } from "@/features/notifications/notify";
import { formatTime12 } from "@/lib/utils/time";
import type { TimelineEntry } from "./today-timeline";
import type { SubjectAttendance } from "@/server/db/attendance";

const STORAGE_KEY = "kelo-notified-today";
const CHECK_INTERVAL_MS = 5 * 60_000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadNotifiedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { day?: string; ids?: string[] };
    return parsed.day === todayKey() ? new Set(parsed.ids ?? []) : new Set();
  } catch {
    return new Set();
  }
}

function persistNotifiedId(existing: Set<string>, id: string): void {
  try {
    existing.add(id);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: todayKey(), ids: [...existing] }),
    );
  } catch {
    // Best-effort de-dup only — worst case is one repeat notification.
  }
}

/**
 * Renders nothing — just periodically checks, while the dashboard is open,
 * whether a class is about to start or a subject just crossed into
 * attendance risk, and fires at most one local notification per item per
 * day. This is client-side polling, not push: it only works while this tab
 * is open, which is an intentional, documented scope limit (see
 * features/notifications/triggers.ts) rather than a bug.
 */
export function DashboardNotifier({
  schedule,
  attendance,
}: {
  schedule: TimelineEntry[];
  attendance: SubjectAttendance[];
}) {
  React.useEffect(() => {
    function check() {
      const now = new Date();
      const nowMinute = now.getHours() * 60 + now.getMinutes();
      const notified = loadNotifiedIds();

      const todaysClasses: ClassCandidate[] = schedule
        .filter((e) => e.day_of_week === now.getDay())
        .map((e) => ({
          id: e.id,
          day_of_week: e.day_of_week,
          start_minute: e.start_minute,
          end_minute: e.end_minute,
          subjectName: e.subject?.name ?? "Class",
          location: e.location,
        }));

      for (const c of findClassesStartingSoon(todaysClasses, nowMinute, notified)) {
        notify(`${c.subjectName} starting soon`, {
          body: `Starts at ${formatTime12(c.start_minute)}${c.location ? ` · ${c.location}` : ""}`,
        });
        persistNotifiedId(notified, classNotificationId(c.id));
      }

      const riskCandidates = attendance.map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.name,
        percentage: s.stats.percentage,
        requiredPercent: s.stats.requiredPercent,
        status: s.stats.status,
      }));
      for (const s of findAttendanceAtRisk(riskCandidates, notified)) {
        notify(`${s.subjectName} attendance at risk`, {
          body: `You're at ${s.percentage}%, below the required ${s.requiredPercent}%.`,
        });
        persistNotifiedId(notified, attendanceNotificationId(s.subjectId));
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [schedule, attendance]);

  return null;
}
