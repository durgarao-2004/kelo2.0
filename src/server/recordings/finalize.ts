import "server-only";
import { findMissingChunkIndexes } from "@/features/recording/chunk-gaps";
import { saveRecording } from "@/server/recordings/save";
import {
  downloadChunksInOrder,
  deleteSessionChunks,
  listChunkIndexes,
} from "@/server/recordings/chunks-store";
import {
  getSession,
  beginFinalizing,
  markUploaded,
  markFailed,
  linkLectureId,
  revertToRecording,
} from "@/server/recordings/session-store";

export type FinalizeResult =
  | { ok: true; lectureId: string }
  | { ok: false; error: "session_not_found" }
  | { ok: false; error: "finalize_in_progress" }
  | { ok: false; error: "missing_chunks"; missing: number[] }
  | { ok: false; error: string };

/**
 * Assemble a recording session's staged chunks into one file and run it
 * through the existing Drive-upload + lecture-creation pipeline. Never
 * reports success unless Drive actually has the file and the lecture row
 * reflects it — mirrors the honesty guarantee `saveRecording` already had.
 *
 * Idempotent: calling this again after a successful finalize returns the
 * same lectureId without re-uploading anything. Safe to retry after a
 * failure — chunks are only deleted once the Drive upload has succeeded.
 */
export async function finalizeRecordingSession(
  userId: string,
  sessionId: string,
  opts: { durationSeconds: number; chunkCount: number },
): Promise<FinalizeResult> {
  const existing = await getSession(userId, sessionId);
  if (!existing) return { ok: false, error: "session_not_found" };

  if (existing.status === "uploaded" && existing.lecture_id) {
    return { ok: true, lectureId: existing.lecture_id };
  }
  if (existing.status === "finalizing") {
    return { ok: false, error: "finalize_in_progress" };
  }

  const session = await beginFinalizing(userId, sessionId);
  if (!session) {
    // Lost a race (another finalize call got there first) — re-check.
    const now = await getSession(userId, sessionId);
    if (now?.status === "uploaded" && now.lecture_id) {
      return { ok: true, lectureId: now.lecture_id };
    }
    return { ok: false, error: "finalize_in_progress" };
  }

  try {
    if (opts.chunkCount <= 0) {
      await markFailed(sessionId, "no_audio");
      return { ok: false, error: "no_audio" };
    }

    const present = await listChunkIndexes(sessionId);
    const missing = findMissingChunkIndexes(present, opts.chunkCount);
    if (missing.length > 0) {
      await revertToRecording(sessionId);
      return { ok: false, error: "missing_chunks", missing };
    }

    if (!session.subject_id) {
      await markFailed(sessionId, "subject_not_found");
      return { ok: false, error: "subject_not_found" };
    }

    const indexes = Array.from({ length: opts.chunkCount }, (_, i) => i);
    const audioBytes = await downloadChunksInOrder(sessionId, indexes);

    const result = await saveRecording({
      userId,
      subjectId: session.subject_id,
      title: session.title,
      durationSeconds: opts.durationSeconds,
      audioBytes,
      mimeType: session.mime_type,
      existingLectureId: session.lecture_id ?? undefined,
    });

    if (!result.ok) {
      if (result.lectureId) await linkLectureId(sessionId, result.lectureId);
      await markFailed(sessionId, result.error);
      return { ok: false, error: result.error };
    }

    await markUploaded(sessionId, result.lectureId, opts.durationSeconds);
    await deleteSessionChunks(sessionId, indexes);
    return { ok: true, lectureId: result.lectureId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "finalize_failed";
    await markFailed(sessionId, message);
    return { ok: false, error: message };
  }
}
