import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasCurrentRecordingConsent, withRecordingConsent } from "@/features/consent/recording-consent";
import type { Json } from "@/lib/supabase/types";

export async function hasRecordingConsent(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("user_settings")
    .select("recording_prefs")
    .eq("user_id", userId)
    .maybeSingle();
  return hasCurrentRecordingConsent(data?.recording_prefs);
}

/** Record consent for the given (server-resolved) user only — there is no
 * client-supplied user id or consent payload here, so this can't be forged
 * by tampering with a request body. */
export async function recordRecordingConsent(userId: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("user_settings")
    .select("recording_prefs")
    .eq("user_id", userId)
    .maybeSingle();

  await db.from("user_settings").upsert(
    {
      user_id: userId,
      recording_prefs: withRecordingConsent(
        data?.recording_prefs,
        new Date().toISOString(),
      ) as unknown as Json,
    },
    { onConflict: "user_id" },
  );
}
