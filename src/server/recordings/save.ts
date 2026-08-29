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
  audio: Blob;
  mimeType: string;
}

export type SaveRecordingResult =
  | { ok: true; lectureId: string }
  | { ok: false; error: string };

function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/**
 * Persist a recorded lecture: ensure the KELO/YEAR/SEMESTER/SUBJECT/Recordings
 * folder exists, upload the audio, and create the lecture row. Lecture status
 * reflects reality at each step (uploading → completed, or failed on error).
 * Transcription/summary are attached later (Phase 8).
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
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "drive_error" };
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const title = input.title?.trim() || `${subject.name} — ${dateStr}`;

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

  try {
    const tree = await ensureFolderTree(input.userId, accessToken, {
      year: subject.year,
      semester: subject.semester,
      subject: subject.name,
    });
    const bytes = await input.audio.arrayBuffer();
    const filename = `${title}.${extFromMime(input.mimeType)}`;
    const fileId = await uploadFile(
      accessToken,
      tree.leaves.Recordings,
      filename,
      input.mimeType,
      bytes,
    );
    await db
      .from("lectures")
      .update({ status: "completed", drive_recording_file_id: fileId })
      .eq("id", lecture.id);
    return { ok: true, lectureId: lecture.id };
  } catch (e) {
    await db
      .from("lectures")
      .update({
        status: "failed",
        error: e instanceof Error ? e.message : "upload_failed",
      })
      .eq("id", lecture.id);
    return { ok: false, error: "upload_failed" };
  }
}
