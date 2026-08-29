"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { login, signup } from "./service";
import { supabaseUsersRepo } from "./users-repo.supabase";
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

/** Convenience for client code that needs to know who is signed in. */
export async function whoami() {
  return getCurrentUser();
}
