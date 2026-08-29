import { getServerEnvDiagnostics } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Secret-free health/diagnostics endpoint.
 * Reports which capabilities are configured (booleans only) and whether the
 * Supabase backend is reachable. Never returns any secret value.
 */
export async function GET() {
  const env = getServerEnvDiagnostics();

  let supabase: { reachable: boolean; usersTable: boolean; detail?: string } = {
    reachable: false,
    usersTable: false,
  };

  try {
    const { error } = await getSupabaseAdmin()
      .from("users")
      .select("id", { count: "exact", head: true });
    if (!error) {
      supabase = { reachable: true, usersTable: true };
    } else {
      // Reached the API but the query failed (e.g. table not created yet).
      supabase = {
        reachable: true,
        usersTable: false,
        detail: error.message,
      };
    }
  } catch (e) {
    supabase = {
      reachable: false,
      usersTable: false,
      detail: e instanceof Error ? e.message : "unknown error",
    };
  }

  const ok =
    env.supabaseServiceRole &&
    env.sessionSecret &&
    supabase.reachable &&
    supabase.usersTable;

  return Response.json(
    {
      ok,
      time: new Date().toISOString(),
      env,
      supabase,
    },
    { status: ok ? 200 : 503 },
  );
}
