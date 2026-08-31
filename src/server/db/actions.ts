"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { parseHHMM } from "@/lib/utils/time";
import {
  createSubject,
  updateSubject,
  deleteSubject,
  findSubjectByName,
} from "./subjects";
import {
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
} from "./schedule";
import { markAttendance } from "./attendance";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

const REVALIDATE = ["/dashboard", "/timetable", "/attendance", "/settings"];
function revalidateAll() {
  for (const p of REVALIDATE) revalidatePath(p);
}

// ---------------- Subjects ----------------
export async function createSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#4f46e5");
  const target = Number(formData.get("target_attendance") ?? 75);
  const totalSessions = Number(formData.get("total_sessions") ?? 33);
  const yearRaw = String(formData.get("year") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim() || null;

  const { error } = await createSubject(user.id, {
    name,
    color,
    target_attendance: Number.isFinite(target) ? target : 75,
    total_sessions: Number.isFinite(totalSessions) && totalSessions > 0 ? Math.floor(totalSessions) : 33,
    year: yearRaw ? Number(yearRaw) : null,
    semester,
  });
  if (error) return { error };
  revalidateAll();
  return { ok: true };
}

export async function updateSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const target = Number(formData.get("target_attendance") ?? 75);
  const totalSessions = Number(formData.get("total_sessions") ?? 33);
  const { error } = await updateSubject(user.id, id, {
    name: String(formData.get("name") ?? "").trim(),
    color: String(formData.get("color") ?? "#4f46e5"),
    target_attendance: Number.isFinite(target) ? target : 75,
    total_sessions: Number.isFinite(totalSessions) && totalSessions > 0 ? Math.floor(totalSessions) : 33,
  });
  if (error) return { error };
  revalidateAll();
  return { ok: true };
}

export async function deleteSubjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await deleteSubject(user.id, String(formData.get("id") ?? ""));
  revalidateAll();
}

// ---------------- Schedule ----------------

/**
 * Adds a class to the timetable, creating its subject inline when the user
 * picked "New subject" instead of an existing one — the timetable is the
 * natural place a student first names a subject, so this is the only path
 * that should be needed (no separate "create the subject" step first).
 *
 * Reuses an existing subject by exact (trimmed) name instead of erroring or
 * inserting a duplicate, so re-submitting the same subject name just adds
 * another schedule slot to it (e.g. a second weekly section) rather than
 * creating a second subject.
 */
export async function createClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const day_of_week = Number(formData.get("day_of_week") ?? -1);
  const start = parseHHMM(String(formData.get("start") ?? ""));
  const end = parseHHMM(String(formData.get("end") ?? ""));
  const location = String(formData.get("location") ?? "").trim() || null;
  if (start === null || end === null) return { error: "Enter valid times." };

  const mode = String(formData.get("subject_mode") ?? "existing");
  let subject_id = String(formData.get("subject_id") ?? "");

  if (mode === "new") {
    const name = String(formData.get("new_subject_name") ?? "").trim();
    if (!name) return { error: "Enter a subject name." };

    const existing = await findSubjectByName(user.id, name);
    if (existing.error) return { error: existing.error };

    if (existing.data) {
      subject_id = existing.data.id;
    } else {
      const color = String(formData.get("color") ?? "#4f46e5");
      const target = Number(formData.get("target_attendance") ?? 75);
      const totalSessions = Number(formData.get("total_sessions") ?? 33);
      const yearRaw = String(formData.get("year") ?? "").trim();
      const semester = String(formData.get("semester") ?? "").trim() || null;

      const created = await createSubject(user.id, {
        name,
        color,
        target_attendance: Number.isFinite(target) ? target : 75,
        total_sessions:
          Number.isFinite(totalSessions) && totalSessions > 0
            ? Math.floor(totalSessions)
            : 33,
        year: yearRaw ? Number(yearRaw) : null,
        semester,
      });
      if (created.error || !created.data) {
        return { error: created.error ?? "Could not create subject." };
      }
      subject_id = created.data.id;
    }
  }

  if (!subject_id) return { error: "Pick or add a subject." };

  const { error } = await createScheduleEntry(user.id, {
    subject_id,
    day_of_week,
    start_minute: start,
    end_minute: end,
    location,
  });
  if (error) {
    // Subject (new or reused) is already saved and usable on its own — the
    // student can just retry the class time; nothing to roll back.
    revalidateAll();
    return { error };
  }
  revalidateAll();
  return { ok: true };
}

export async function createScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const subject_id = String(formData.get("subject_id") ?? "");
  const day_of_week = Number(formData.get("day_of_week") ?? -1);
  const start = parseHHMM(String(formData.get("start") ?? ""));
  const end = parseHHMM(String(formData.get("end") ?? ""));
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!subject_id) return { error: "Pick a subject." };
  if (start === null || end === null) return { error: "Enter valid times." };

  const { error } = await createScheduleEntry(user.id, {
    subject_id,
    day_of_week,
    start_minute: start,
    end_minute: end,
    location,
  });
  if (error) return { error };
  revalidateAll();
  return { ok: true };
}

export async function updateScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const subject_id = String(formData.get("subject_id") ?? "");
  const day_of_week = Number(formData.get("day_of_week") ?? -1);
  const start = parseHHMM(String(formData.get("start") ?? ""));
  const end = parseHHMM(String(formData.get("end") ?? ""));
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!subject_id) return { error: "Pick a subject." };
  if (start === null || end === null) return { error: "Enter valid times." };

  const { error } = await updateScheduleEntry(user.id, id, {
    subject_id,
    day_of_week,
    start_minute: start,
    end_minute: end,
    location,
  });
  if (error) return { error };
  revalidateAll();
  return { ok: true };
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await deleteScheduleEntry(user.id, String(formData.get("id") ?? ""));
  revalidateAll();
}

// ---------------- Attendance ----------------
export async function markAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const subject_id = String(formData.get("subject_id") ?? "");
  const status = String(formData.get("status") ?? "") as
    | "attended"
    | "missed"
    | "cancelled";
  const occurred_on =
    String(formData.get("occurred_on") ?? "") ||
    new Date().toISOString().slice(0, 10);
  const scheduleRaw = String(formData.get("schedule_entry_id") ?? "");
  if (!subject_id || !["attended", "missed", "cancelled"].includes(status)) {
    return { error: "Invalid request." };
  }
  const { error } = await markAttendance(user.id, {
    subject_id,
    schedule_entry_id: scheduleRaw || null,
    occurred_on,
    status,
  });
  if (error) return { error };
  revalidateAll();
  return { ok: true };
}
