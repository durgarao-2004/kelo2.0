import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import {
  computeAttendanceFromRecords,
  validateAttendanceMutation,
  type AttendanceStats,
} from "@/features/attendance/calc";
import type { DbResult } from "./subjects";

export type AttendanceRecord =
  Database["public"]["Tables"]["attendance_records"]["Row"];

export interface SubjectAttendance {
  subjectId: string;
  name: string;
  color: string;
  stats: AttendanceStats;
}

export async function listAttendance(
  userId: string,
  subjectId?: string,
): Promise<DbResult<AttendanceRecord[]>> {
  let query = getSupabaseAdmin()
    .from("attendance_records")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false });
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query;
  return { data: data ?? [], error: error?.message ?? null };
}

/** Per-subject attendance stats for the whole account. */
export async function attendanceSummary(
  userId: string,
): Promise<DbResult<SubjectAttendance[]>> {
  const db = getSupabaseAdmin();
  const [{ data: subjects, error: sErr }, { data: records, error: rErr }] =
    await Promise.all([
      db
        .from("subjects")
        .select("id, name, color, target_attendance, total_sessions")
        .eq("user_id", userId)
        .order("name"),
      db
        .from("attendance_records")
        .select("subject_id, status")
        .eq("user_id", userId),
    ]);

  const error = sErr?.message ?? rErr?.message ?? null;
  if (!subjects) return { data: [], error };

  const bySubject = new Map<string, { status: "attended" | "missed" | "cancelled" }[]>();
  for (const r of records ?? []) {
    const list = bySubject.get(r.subject_id) ?? [];
    list.push({ status: r.status });
    bySubject.set(r.subject_id, list);
  }

  const data: SubjectAttendance[] = subjects.map((s) => ({
    subjectId: s.id,
    name: s.name,
    color: s.color,
    stats: computeAttendanceFromRecords(
      bySubject.get(s.id) ?? [],
      Number(s.target_attendance),
      Number(s.total_sessions),
    ),
  }));

  return { data, error };
}

/**
 * Record one attendance mark, rejecting it if it would push the subject's
 * conducted-session count past its planned total. Upsert-keyed by the same
 * (subject, date, schedule-entry) slot the unique index enforces, so marking
 * an already-recorded slot again changes its status rather than adding a
 * second session — that existing record is excluded from the "conducted so
 * far" count used for validation, since it's being replaced, not added to.
 */
export async function markAttendance(
  userId: string,
  input: {
    subject_id: string;
    schedule_entry_id?: string | null;
    occurred_on: string; // YYYY-MM-DD
    status: "attended" | "missed" | "cancelled";
    note?: string | null;
  },
): Promise<{ error: string | null }> {
  const db = getSupabaseAdmin();

  const [{ data: subject }, { data: existingRecords }] = await Promise.all([
    db
      .from("subjects")
      .select("total_sessions")
      .eq("user_id", userId)
      .eq("id", input.subject_id)
      .maybeSingle(),
    db
      .from("attendance_records")
      .select("occurred_on, schedule_entry_id, status")
      .eq("user_id", userId)
      .eq("subject_id", input.subject_id),
  ]);
  if (!subject) return { error: "Subject not found." };

  const scheduleKey = input.schedule_entry_id ?? null;
  const thisSlot = (r: { occurred_on: string; schedule_entry_id: string | null }) =>
    r.occurred_on === input.occurred_on && (r.schedule_entry_id ?? null) === scheduleKey;
  const conductedExcludingThisSlot = (existingRecords ?? [])
    .filter((r) => !thisSlot(r))
    .filter((r) => r.status === "attended" || r.status === "missed").length;

  const check = validateAttendanceMutation({
    conductedExcludingThisSlot,
    nextStatus: input.status,
    totalSessions: Number(subject.total_sessions),
  });
  if (!check.ok) return { error: check.error };

  const { error } = await db.from("attendance_records").upsert(
    {
      user_id: userId,
      subject_id: input.subject_id,
      schedule_entry_id: input.schedule_entry_id ?? null,
      occurred_on: input.occurred_on,
      status: input.status,
      note: input.note ?? null,
    },
    { onConflict: "user_id,subject_id,occurred_on,schedule_entry_id" },
  );
  return { error: error?.message ?? null };
}

export async function deleteAttendance(
  userId: string,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseAdmin()
    .from("attendance_records")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  return { error: error?.message ?? null };
}
