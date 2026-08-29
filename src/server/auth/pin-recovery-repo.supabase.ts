import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  CreateRecoveryTokenInput,
  PinRecoveryRepo,
  RecoveryTokenRow,
} from "./pin-recovery-repo";

/** Supabase-backed implementation of the PIN-recovery repository (server-only). */
export function supabasePinRecoveryRepo(): PinRecoveryRepo {
  const db = getSupabaseAdmin();
  return {
    async countRecentRequests(userId, sinceIso) {
      const { count } = await db
        .from("pin_recovery_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", sinceIso);
      return count ?? 0;
    },

    async createToken(input: CreateRecoveryTokenInput) {
      await db.from("pin_recovery_tokens").insert({
        user_id: input.userId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
      });
    },

    async findValidToken(tokenHash, nowIso): Promise<RecoveryTokenRow | null> {
      const { data } = await db
        .from("pin_recovery_tokens")
        .select("id, user_id, expires_at, used_at")
        .eq("token_hash", tokenHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        expiresAt: data.expires_at,
        usedAt: data.used_at,
      };
    },

    async markTokenUsed(tokenId) {
      await db
        .from("pin_recovery_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenId);
    },
  };
}
