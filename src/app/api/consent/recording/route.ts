import { getCurrentUser } from "@/server/auth/current-user";
import { recordRecordingConsent } from "@/server/settings/consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record that the signed-in user has accepted the recording-consent notice.
 * The user is resolved from the session cookie, never from the request body
 * — there is nothing here a client could tamper with to forge consent for
 * another account or fabricate an earlier consent timestamp.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  await recordRecordingConsent(user.id);
  return Response.json({ ok: true });
}
