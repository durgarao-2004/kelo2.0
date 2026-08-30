import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSubject } from "@/server/db/subjects";
import { getValidAccessToken, DriveNotConnectedError } from "@/server/drive/tokens";
import { ensureFolderTree, uploadFile } from "@/server/drive/client";

export interface SaveRecordingInput {
  userId: string;
  subjectId: string;
  title: string | null;
  durationSeconds: number;
  audioBytes: Uint8Array;
  mimeType: string;
  /** Reuse this lecture row (a prior attempt got this far before failing)
   * instead of inserting a new one — keeps a retried finalize from ever
   * creating a duplicate lecture. */
  existingLectureId?: string;
}

export type SaveRecordingResult =
  | { ok: true; lectureId: string }
  // `lectureId` is included on failure whenever a row was created/reused,
  // so the caller can remember it and avoid a duplicate on the next retry.
  | { ok: false; error: string; lectureId?: string };

function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/**
 * Persist a recorded lecture: ensure the KELO/YEAR/SEMESTER/SUBJECT/Recordings
 * folder exists, upload the audio, and create the lecture row. Lecture status
 * reflects reality at each step (uploading → uploaded, or failed on error).
 * "uploaded" is not "completed" — transcription/analysis still need to run.
 */
export async function saveRecording(
  input: SaveRecordingInput,
): Promise<SaveRecordingResult> {
  const db = getSupabaseAdmin();

  const { data: subject } = await getSubject(input.userId, input.subjectId);
  if (!subject) return { ok: false, error: "subject_not_found" };

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(input.userId);
  } catch (e) {
    if (e instanceof DriveNotConnectedError) {
      return { ok: false, error: e.message, lectureId: input.existingLectureId };
    }
    return { ok: false, error: "drive_error", lectureId: input.existingLectureId };
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const title = input.title?.trim() || `${subject.name} — ${dateStr}`;

  let lectureId = input.existingLectureId;
  // If a prior attempt already got the audio to Drive but crashed before
  // recording that fact, reuse the existing file id instead of uploading a
  // second copy — this is the one moment (Drive upload succeeds, then the
  // very next DB write fails) that could otherwise leave an orphaned
  // duplicate recording in Drive.
  let existingRecordingFileId: string | null = null;
  if (lectureId) {
    const { data: existing, error: updErr } = await db
      .from("lectures")
      .update({
        subject_id: input.subjectId,
        title,
        status: "uploading",
        duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
        error: null,
      })
      .eq("id", lectureId)
      .eq("user_id", input.userId)
      .select("drive_recording_file_id")
      .maybeSingle();
    if (updErr) return { ok: false, error: "db_error", lectureId };
    existingRecordingFileId = existing?.drive_recording_file_id ?? null;
  } else {
    const { data: lecture, error: insErr } = await db
      .from("lectures")
      .insert({
        user_id: input.userId,
        subject_id: input.subjectId,
        title,
        status: "uploading",
        duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
      })
      .select("id")
      .single();
    if (insErr || !lecture) return { ok: false, error: "db_error" };
    lectureId = lecture.id;
  }

  try {
    let fileId = existingRecordingFileId;
    if (!fileId) {
      const tree = await ensureFolderTree(input.userId, accessToken, {
        year: subject.year,
        semester: subject.semester,
        subject: subject.name,
      });
      const filename = `${title}.${extFromMime(input.mimeType)}`;
      fileId = await uploadFile(
        accessToken,
        tree.leaves.Recordings,
        filename,
        input.mimeType,
        input.audioBytes.buffer.slice(
          input.audioBytes.byteOffset,
          input.audioBytes.byteOffset + input.audioBytes.byteLength,
        ) as ArrayBuffer,
      );
    }
    await db
      .from("lectures")
      .update({ status: "uploaded", drive_recording_file_id: fileId })
      .eq("id", lectureId);
    return { ok: true, lectureId };
  } catch (e) {
    await db
      .from("lectures")
      .update({
        status: "failed",
        error: e instanceof Error ? e.message : "upload_failed",
      })
      .eq("id", lectureId);
    return { ok: false, error: "upload_failed", lectureId };
  }
}
