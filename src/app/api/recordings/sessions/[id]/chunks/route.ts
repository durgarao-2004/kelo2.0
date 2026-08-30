import { getCurrentUser } from "@/server/auth/current-user";
import { ensureSession, getSession } from "@/server/recordings/session-store";
import { storeChunk } from "@/server/recordings/chunks-store";
import { hasRecordingConsent } from "@/server/settings/consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One chunk is small (a few seconds of audio); this only needs to cover a
// slow connection, not a whole lecture.
export const maxDuration = 30;

/**
 * Stage one recorded chunk. Creates the session row on the first chunk seen
 * for this id; every call is idempotent by (session, index) so retries and
 * duplicate sends (flaky network, client re-drive) never create duplicates.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: sessionId } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const chunk = form.get("chunk");
  const index = Number(form.get("index"));
  const subjectId = String(form.get("subject_id") ?? "");
  const title = form.get("title") ? String(form.get("title")) : null;
  const mimeType = String(form.get("mime_type") || "audio/webm");

  if (!(chunk instanceof Blob) || chunk.size === 0) {
    return Response.json({ error: "missing_chunk" }, { status: 400 });
  }
  if (!Number.isInteger(index) || index < 0) {
    return Response.json({ error: "invalid_index" }, { status: 400 });
  }

  const existing = await getSession(user.id, sessionId);
  if (existing && existing.status === "uploaded") {
    return Response.json({ error: "already_finalized" }, { status: 409 });
  }

  if (!existing) {
    if (!subjectId) {
      return Response.json({ error: "missing_subject" }, { status: 400 });
    }
    // Enforced here too, not just in the UI — the consent gate must not be
    // bypassable by talking to the API directly.
    if (!(await hasRecordingConsent(user.id))) {
      return Response.json({ error: "consent_required" }, { status: 403 });
    }
    const created = await ensureSession({
      id: sessionId,
      userId: user.id,
      subjectId,
      title,
      mimeType,
    });
    if (!created) {
      return Response.json({ error: "session_create_failed" }, { status: 502 });
    }
  }

  try {
    const bytes = await chunk.arrayBuffer();
    await storeChunk(sessionId, index, bytes, chunk.type || mimeType);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "chunk_store_failed" },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
