import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import { clientEnv } from "@/lib/env.public";
import type { Database } from "./types";

/**
 * Privileged Supabase client using the service-role key. Bypasses RLS, so it
 * must ONLY ever run on the server, and every query MUST be scoped by user_id.
 * Never import this from a Client Component.
 */
let cached: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (cached) return cached;
  const env = getServerEnv();
  cached = createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-kelo-server": "1" } },
    },
  );
  return cached;
}
