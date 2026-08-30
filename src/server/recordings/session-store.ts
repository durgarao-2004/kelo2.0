import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, RecordingSessionStatus } from "@/lib/supabase/types";

export type RecordingSession =
  Database["public"]["Tables"]["recording_sessions"]["Row"];

/** Load a session scoped to its owner; never leaks another user's session. */
export async function getSession(
  userId: string,
  sessionId: string,
): Promise<RecordingSession | null> {
  const { data } = await getSupabaseAdmin()
    .from("recording_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Create the session row on the first chunk for a given id, or no-op if it
 * already exists (chunks after the first just re-send the same metadata).
 * Never overwrites status/lecture_id — those are only ever moved forward by
 * the finalize pipeline.
 */
export async function ensureSession(input: {
  id: string;
  userId: string;
  subjectId: string;
  title: string | null;
  mimeType: string;
}): Promise<RecordingSession | null> {
  const db = getSupabaseAdmin();
  const existing = await getSession(input.userId, input.id);
  if (existing) return existing;

  const { data, error } = await db
    .from("recording_sessions")
    .insert({
      id: input.id,
      user_id: input.userId,
      subject_id: input.subjectId,
      title: input.title,
      mime_type: input.mimeType,
      status: "recording",
    })
    .select("*")
    .maybeSingle();
  if (error) {
    // Lost a race with a concurrent first-chunk request for the same id.
    return getSession(input.userId, input.id);
  }
  return data;
}

/**
 * Atomically move a session into `finalizing`, refusing to start a second
 * concurrent finalize. Returns null (no-op) if the session wasn't in a
 * finalize-able state — caller re-reads status to report why.
 */
export async function beginFinalizing(
  userId: string,
  sessionId: string,
): Promise<RecordingSession | null> {
  const { data } = await getSupabaseAdmin()
    .from("recording_sessions")
    .update({ status: "finalizing", error: null })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .in("status", ["recording", "failed"])
    .select("*")
    .maybeSingle();
  return data ?? null;
}

export async function markUploaded(
  sessionId: string,
  lectureId: string,
  durationSeconds: number,
): Promise<void> {
  await getSupabaseAdmin()
    .from("recording_sessions")
    .update({
      status: "uploaded",
      lecture_id: lectureId,
      error: null,
      duration_seconds: Math.max(0, Math.round(durationSeconds)),
    })
    .eq("id", sessionId);
}

/** Remember which lecture row a (possibly failed) attempt created, so a
 * retried finalize reuses it instead of creating a duplicate. */
export async function linkLectureId(
  sessionId: string,
  lectureId: string,
): Promise<void> {
  await getSupabaseAdmin()
    .from("recording_sessions")
    .update({ lecture_id: lectureId })
    .eq("id", sessionId);
}

export async function markFailed(
  sessionId: string,
  error: string,
): Promise<void> {
  await getSupabaseAdmin()
    .from("recording_sessions")
    .update({ status: "failed", error })
    .eq("id", sessionId);
}

/** Revert a session that was moved to `finalizing` back to `recording`. */
export async function revertToRecording(sessionId: string): Promise<void> {
  await getSupabaseAdmin()
    .from("recording_sessions")
    .update({ status: "recording" })
    .eq("id", sessionId)
    .eq("status", "finalizing");
}

export function isTerminalStatus(status: RecordingSessionStatus): boolean {
  return status === "uploaded";
}
