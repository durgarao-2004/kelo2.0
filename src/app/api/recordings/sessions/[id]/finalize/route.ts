import { getCurrentUser } from "@/server/auth/current-user";
import { finalizeRecordingSession } from "@/server/recordings/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Assembling chunks + the Drive upload happens here; mirrors the old
// single-shot upload route's budget.
export const maxDuration = 300;

/**
 * Assemble a recording session's staged chunks and upload once to Drive.
 * Idempotent — safe for the client to call again after a dropped response
 * (returns the same lectureId rather than re-uploading).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: sessionId } = await ctx.params;

  let body: { durationSeconds?: number; chunkCount?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const durationSeconds = Number(body.durationSeconds ?? 0);
  const chunkCount = Number(body.chunkCount ?? 0);
  if (!Number.isFinite(chunkCount) || chunkCount < 0) {
    return Response.json({ error: "invalid_chunk_count" }, { status: 400 });
  }

  const result = await finalizeRecordingSession(user.id, sessionId, {
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    chunkCount,
  });

  if (result.ok) {
    return Response.json({ lectureId: result.lectureId });
  }
  if ("missing" in result) {
    return Response.json(
      { error: result.error, missing: result.missing },
      { status: 409 },
    );
  }
  if (result.error === "session_not_found") {
    return Response.json({ error: result.error }, { status: 404 });
  }
  if (result.error === "finalize_in_progress") {
    return Response.json({ error: result.error }, { status: 409 });
  }
  if (result.error === "drive_not_connected" || result.error === "reauth_required") {
    return Response.json({ error: result.error }, { status: 409 });
  }
  return Response.json({ error: result.error }, { status: 502 });
}
