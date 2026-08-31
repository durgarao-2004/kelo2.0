import { getCurrentUser } from "@/server/auth/current-user";
import { upsertPushSubscription } from "@/server/db/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscribeBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/**
 * Associates a browser push subscription with the signed-in user. The user
 * is always resolved from the session cookie, never trusted from the body —
 * a client can't register a subscription for someone else's account.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const { error } = await upsertPushSubscription(
    user.id,
    { endpoint, keys: { p256dh, auth } },
    request.headers.get("user-agent"),
  );
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json({ ok: true });
}
