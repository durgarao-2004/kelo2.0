import { getCurrentUser } from "@/server/auth/current-user";
import { deletePushSubscription } from "@/server/db/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return Response.json({ error: "invalid_request" }, { status: 400 });

  const { error } = await deletePushSubscription(user.id, endpoint);
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json({ ok: true });
}
