import { getCurrentUser } from "@/server/auth/current-user";
import { getDriveConnection } from "@/server/db/drive";
import { saveRecording } from "@/server/recordings/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow reasonably large lecture audio uploads.
export const maxDuration = 60;

/**
 * Accepts a browser-recorded audio blob and saves it. Requires the user to have
 * connected Google Drive (the recording store). Returns 409 when Drive isn't
 * connected so the client can prompt to connect (and keep a local copy).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const audio = form.get("audio");
  const subjectId = String(form.get("subject_id") ?? "");
  const durationSeconds = Number(form.get("duration_seconds") ?? 0);
  const title = form.get("title") ? String(form.get("title")) : null;

  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "missing_audio" }, { status: 400 });
  }
  if (!subjectId) {
    return Response.json({ error: "missing_subject" }, { status: 400 });
  }

  const drive = await getDriveConnection(user.id);
  if (!drive.connected) {
    return Response.json({ error: "drive_not_connected" }, { status: 409 });
  }

  const result = await saveRecording({
    userId: user.id,
    subjectId,
    title,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    audio,
    mimeType: audio.type || "audio/webm",
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }
  return Response.json({ lectureId: result.lectureId });
}
