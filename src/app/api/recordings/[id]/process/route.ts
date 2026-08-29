import { getCurrentUser } from "@/server/auth/current-user";
import { processLecture } from "@/server/recordings/process";
import { toUserFacingProcessingError } from "@/lib/errors/user-facing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcription + analysis of a full lecture can take a few minutes.
export const maxDuration = 300;

/**
 * Run the post-recording pipeline (transcribe → analyze → store → Drive → index)
 * for one lecture. Triggered by the client after a successful upload; safe to
 * retry from the lectures view. The raw failure reason is stored server-side
 * (lectures.error) for diagnosis; only a clean, generic message is returned
 * to the client.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await processLecture(user.id, id);
  if (result.ok) return Response.json(result);
  return Response.json(
    { ok: false, error: toUserFacingProcessingError(result.error) },
    { status: 502 },
  );
}
