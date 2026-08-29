import { getCurrentUser } from "@/server/auth/current-user";
import { processLecture } from "@/server/recordings/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcription + analysis of a full lecture can take a few minutes.
export const maxDuration = 300;

/**
 * Run the post-recording pipeline (transcribe → analyze → store → Drive → index)
 * for one lecture. Triggered by the client after a successful upload; safe to
 * retry from the lectures view.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await processLecture(user.id, id);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
