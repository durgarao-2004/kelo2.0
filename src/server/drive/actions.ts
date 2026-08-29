"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto/tokens";
import { disconnect } from "./tokens";
import { revokeToken } from "./oauth";

export async function disconnectDriveAction(): Promise<void> {
  const user = await requireUser();
  const { data } = await getSupabaseAdmin()
    .from("drive_connections")
    .select("refresh_token_enc, access_token_enc")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) {
    const enc = data.refresh_token_enc ?? data.access_token_enc;
    try {
      await revokeToken(decryptToken(enc));
    } catch {
      // best-effort revoke; ignore failures
    }
  }
  await disconnect(user.id);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
