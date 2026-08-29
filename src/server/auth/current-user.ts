import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface CurrentUser {
  id: string;
  email: string;
  sessionVersion: number;
}

/**
 * Resolve the signed-in user from the session cookie. Verifies the token
 * signature, loads the user, and confirms the token's session_version still
 * matches (so a bumped version invalidates the session). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("id, email, session_version")
    .eq("id", payload.sub)
    .maybeSingle();

  if (error || !data) return null;
  if (data.session_version !== payload.sv) return null;

  return {
    id: data.id,
    email: data.email,
    sessionVersion: data.session_version,
  };
});

/** For protected server components/actions: redirect to /login if signed out. */
export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login",
    );
  }
  return user;
}
