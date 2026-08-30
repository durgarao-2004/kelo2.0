import { getCurrentUser } from "@/server/auth/current-user";
import { processLecture } from "@/server/recordings/process";
import { toUserFacingProcessingError } from "@/lib/errors/user-facing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcription (up to ~6min for a long lecture) + analysis + Drive uploads.
export const maxDuration = 600;

/**
 * Run the post-recording pipeline (transcribe → analyze → store → Drive → index)
 * for one lecture. Triggered by the client after a successful upload; safe to
 * retry from the lectures view — resumes from whatever stage hasn't
 * succeeded yet rather than starting over. The raw failure reason is stored
 * server-side (lectures.error) for diagnosis; only a clean, generic message
 * is returned to the client.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };

  const result = await processLecture(user.id, id, { forceReanalyze: Boolean(body.force) });
  if (result.ok) return Response.json(result);
  if (result.error === "not_found") {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (result.error === "already_processing") {
    return Response.json({ ok: false, error: "already_processing" }, { status: 409 });
  }
  return Response.json(
    { ok: false, error: toUserFacingProcessingError(result.error) },
    { status: 502 },
  );
}
