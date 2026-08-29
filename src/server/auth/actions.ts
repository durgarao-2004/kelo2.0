"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { login, signup } from "./service";
import { requestPinRecovery, resetPinWithToken } from "./pin-recovery-service";
import { supabaseUsersRepo } from "./users-repo.supabase";
import { supabasePinRecoveryRepo } from "./pin-recovery-repo.supabase";
import { sendPinRecoveryEmail } from "@/server/email/resend";
import { getCurrentUser } from "./current-user";

export interface AuthFormState {
  error?: string;
  ok?: boolean;
}

async function setSessionCookie(userId: string, sessionVersion: number) {
  const token = await createSessionToken({ sub: userId, sv: sessionVersion });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  // Only allow same-origin absolute paths (prevents open redirects).
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const confirmPin = String(formData.get("confirmPin") ?? "");
  const next = safeNext(formData.get("next"));

  const result = await signup({ email, pin, confirmPin }, supabaseUsersRepo());
  if (!result.ok) {
    return { error: result.message };
  }
  await setSessionCookie(result.userId, result.sessionVersion);
  redirect(next);
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const next = safeNext(formData.get("next"));

  const result = await login({ email, pin }, supabaseUsersRepo());
  if (!result.ok) {
    return { error: result.message };
  }
  await setSessionCookie(result.userId, result.sessionVersion);
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export interface ForgotPinFormState {
  sent?: boolean;
}

/**
 * Always reports success — never reveals whether the email is registered,
 * rate-limited, or the send failed (enumeration protection + no info leaks).
 * Real failures are logged server-side only.
 */
export async function forgotPinAction(
  _prev: ForgotPinFormState,
  formData: FormData,
): Promise<ForgotPinFormState> {
  const email = String(formData.get("email") ?? "");
  const origin = await requestOrigin();

  try {
    await requestPinRecovery(
      { email, resetUrlBase: `${origin}/reset-pin` },
      supabaseUsersRepo(),
      supabasePinRecoveryRepo(),
      sendPinRecoveryEmail,
    );
  } catch (e) {
    console.error("pin recovery request failed:", e instanceof Error ? e.message : e);
  }
  return { sent: true };
}

export interface ResetPinFormState {
  error?: string;
}

export async function resetPinAction(
  _prev: ResetPinFormState,
  formData: FormData,
): Promise<ResetPinFormState> {
  const token = String(formData.get("token") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const confirmPin = String(formData.get("confirmPin") ?? "");

  const result = await resetPinWithToken(
    { token, pin, confirmPin },
    supabaseUsersRepo(),
    supabasePinRecoveryRepo(),
  );
  if (!result.ok) {
    return { error: result.message };
  }
  redirect("/login?reset=success");
}

/** Convenience for client code that needs to know who is signed in. */
export async function whoami() {
  return getCurrentUser();
}
