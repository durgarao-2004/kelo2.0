import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import {
  validateSlot,
  conflictsWithExisting,
  type TimeSlot,
} from "@/features/timetable/overlap";
import type { DbResult } from "./subjects";

export type ScheduleEntry =
  Database["public"]["Tables"]["schedule_entries"]["Row"];

export interface ScheduleEntryWithSubject extends ScheduleEntry {
  subject: { id: string; name: string; color: string } | null;
}

export async function listSchedule(
  userId: string,
): Promise<DbResult<ScheduleEntryWithSubject[]>> {
  const { data, error } = await getSupabaseAdmin()
    .from("schedule_entries")
    .select("*, subject:subjects(id, name, color)")
    .eq("user_id", userId)
    .order("day_of_week", { ascending: true })
    .order("start_minute", { ascending: true });
  return {
    data: (data as ScheduleEntryWithSubject[] | null) ?? [],
    error: error?.message ?? null,
  };
}

export async function createScheduleEntry(
  userId: string,
  input: {
    subject_id: string;
    day_of_week: number;
    start_minute: number;
    end_minute: number;
    location?: string | null;
  },
): Promise<DbResult<ScheduleEntry | null>> {
  const validation = validateSlot(input);
  if (!validation.valid) return { data: null, error: validation.reason };

  const db = getSupabaseAdmin();
  const { data: existing, error: listErr } = await db
    .from("schedule_entries")
    .select("id, day_of_week, start_minute, end_minute")
    .eq("user_id", userId)
    .eq("day_of_week", input.day_of_week);
  if (listErr) return { data: null, error: listErr.message };

  if (conflictsWithExisting(input as TimeSlot, (existing ?? []) as TimeSlot[])) {
    return { data: null, error: "This class overlaps another on the same day." };
  }

  const { data, error } = await db
    .from("schedule_entries")
    .insert({ user_id: userId, ...input })
    .select("*")
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function updateScheduleEntry(
  userId: string,
  id: string,
  input: {
    subject_id: string;
    day_of_week: number;
    start_minute: number;
    end_minute: number;
    location?: string | null;
  },
): Promise<DbResult<ScheduleEntry | null>> {
  const validation = validateSlot(input);
  if (!validation.valid) return { data: null, error: validation.reason };

  const db = getSupabaseAdmin();
  const { data: existing, error: listErr } = await db
    .from("schedule_entries")
    .select("id, day_of_week, start_minute, end_minute")
    .eq("user_id", userId)
    .eq("day_of_week", input.day_of_week);
  if (listErr) return { data: null, error: listErr.message };

  if (
    conflictsWithExisting(input as TimeSlot, (existing ?? []) as TimeSlot[], id)
  ) {
    return { data: null, error: "This class overlaps another on the same day." };
  }

  const { data, error } = await db
    .from("schedule_entries")
    .update(input)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function deleteScheduleEntry(
  userId: string,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseAdmin()
    .from("schedule_entries")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  return { error: error?.message ?? null };
}
