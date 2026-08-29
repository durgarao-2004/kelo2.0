import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CreateUserResult, UserAuthRow, UsersRepo } from "./users-repo";

/** Supabase-backed implementation of the auth repository (server-only). */
export function supabaseUsersRepo(): UsersRepo {
  const db = getSupabaseAdmin();
  return {
    async findByEmail(email): Promise<UserAuthRow | null | "error"> {
      const { data, error } = await db
        .from("users")
        .select("id, pin_hash, failed_attempts, locked_until, session_version")
        .eq("email", email)
        .maybeSingle();
      if (error) return "error";
      return data ?? null;
    },

    async existsByEmail(email) {
      const { data, error } = await db
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (error) return "error";
      return Boolean(data);
    },

    async create(email, pinHash): Promise<CreateUserResult> {
      const { data, error } = await db
        .from("users")
        .insert({ email, pin_hash: pinHash })
        .select("id, session_version")
        .single();
      if (error) {
        if (error.code === "23505") return { kind: "conflict" };
        return { kind: "error" };
      }
      return {
        kind: "created",
        id: data.id,
        session_version: data.session_version,
      };
    },

    async setAuthState(id, state) {
      await db.from("users").update(state).eq("id", id);
    },

    async ensureSettings(id) {
      await db
        .from("user_settings")
        .upsert({ user_id: id }, { onConflict: "user_id" })
        .then(
          () => undefined,
          () => undefined,
        );
    },

    async getSessionVersion(id) {
      const { data } = await db
        .from("users")
        .select("session_version")
        .eq("id", id)
        .maybeSingle();
      return data?.session_version ?? null;
    },

    async setSessionVersion(id, version) {
      await db.from("users").update({ session_version: version }).eq("id", id);
    },

    async setPinHash(id, pinHash) {
      await db.from("users").update({ pin_hash: pinHash }).eq("id", id);
    },
  };
}
