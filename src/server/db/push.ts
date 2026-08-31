import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Upsert keyed by `endpoint` (globally unique, not per-user): a browser push
 * subscription belongs to one device/browser registration, not to whichever
 * account happened to create it. Re-subscribing under a different signed-in
 * user reassigns ownership instead of creating a second row, so a shared
 * device switching accounts can never leave the previous user still able to
 * receive that device's pushes.
 */
export async function upsertPushSubscription(
  userId: string,
  input: PushSubscriptionInput,
  userAgent: string | null,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseAdmin().from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  return { error: error?.message ?? null };
}

/** Only removes the subscription if it belongs to this user — a stranger
 * who somehow learned another device's opaque endpoint can't unsubscribe it. */
export async function deletePushSubscription(
  userId: string,
  endpoint: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  return { error: error?.message ?? null };
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  await getSupabaseAdmin().from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function listPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRow[]> {
  const { data } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  return data ?? [];
}

export async function hasPushSubscription(userId: string): Promise<boolean> {
  const { count } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return Boolean(count && count > 0);
}

/**
 * Atomically claims a (user, key) dedupe slot: returns true only for the
 * caller that actually inserted the row, so two overlapping dispatch runs
 * (or a retry) can never send the same reminder twice. Callers pass a key
 * that already encodes the date (e.g. `class-<scheduleId>-2026-08-31`) —
 * there's no separate "today" boundary to get wrong.
 */
export async function claimPushDedupe(
  userId: string,
  dedupeKey: string,
): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("push_dedupe")
    .insert({ user_id: userId, dedupe_key: dedupeKey })
    .select("id")
    .maybeSingle();
  if (error || !data) return false;
  return true;
}
