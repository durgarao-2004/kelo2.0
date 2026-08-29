import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env.public";
import type { Database } from "./types";

/**
 * Public anon client (RLS-gated). KELO uses custom PIN auth and routes all user
 * data through the server, so this client is intentionally limited — it is used
 * only for public, non-privileged operations (e.g. connectivity checks). It can
 * read NO user rows because RLS denies the anon role by design.
 */
let cached: SupabaseClient<Database> | null = null;

export function getSupabaseAnon(): SupabaseClient<Database> {
  if (cached) return cached;
  cached = createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  return cached;
}
