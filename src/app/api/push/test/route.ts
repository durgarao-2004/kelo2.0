import { getCurrentUser } from "@/server/auth/current-user";
import { sendPushToUser, getPushConfig } from "@/server/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends one real push to every subscription the signed-in user has — lets
 * Settings offer a "Send test notification" button that proves delivery
 * actually works, instead of asking the student to just trust it. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!getPushConfig()) {
    return Response.json({ error: "push_not_configured" }, { status: 503 });
  }

  const result = await sendPushToUser(user.id, {
    title: "KELO notifications are on",
    body: "You'll get real alerts for class reminders and lecture updates.",
    url: "/dashboard",
    tag: "kelo-test",
  });

  if (result.sent === 0) {
    return Response.json(
      { error: "no_active_subscriptions", ...result },
      { status: 404 },
    );
  }
  return Response.json({ ok: true, ...result });
}
