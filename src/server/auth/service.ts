import bcrypt from "bcryptjs";
import { validatePin, pinsMatch, isSixDigits } from "@/lib/auth/pin";
import type { UsersRepo } from "./users-repo";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// A valid bcrypt hash of an unguessable value, used to equalize timing when the
// email doesn't exist (mitigates user enumeration via response time).
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO3jqk2m0kQ8gJp2eE0f6q1r9r2s3t4u5";

export type AuthErrorCode =
  | "invalid_email"
  | "invalid_pin"
  | "pin_mismatch"
  | "weak_pin"
  | "email_taken"
  | "invalid_credentials"
  | "account_locked"
  | "server_error";

export interface AuthSuccess {
  ok: true;
  userId: string;
  sessionVersion: number;
}
export interface AuthFailure {
  ok: false;
  code: AuthErrorCode;
  message: string;
  lockedUntil?: string;
}
export type AuthResult = AuthSuccess | AuthFailure;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function fail(
  code: AuthErrorCode,
  message: string,
  lockedUntil?: string,
): AuthFailure {
  return { ok: false, code, message, lockedUntil };
}

export async function signup(
  input: { email: string; pin: string; confirmPin: string },
  repo: UsersRepo,
  now: number = Date.now(),
): Promise<AuthResult> {
  void now;
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return fail("invalid_email", "Enter a valid email address.");
  }
  if (!isSixDigits(input.pin)) {
    return fail("invalid_pin", "PIN must be exactly 6 digits.");
  }
  if (!pinsMatch(input.pin, input.confirmPin)) {
    return fail("pin_mismatch", "The two PINs don’t match.");
  }
  const strength = validatePin(input.pin);
  if (!strength.valid) {
    return fail("weak_pin", strength.reason);
  }

  const exists = await repo.existsByEmail(email);
  if (exists === "error") {
    return fail("server_error", "Something went wrong. Please try again.");
  }
  if (exists) {
    return fail("email_taken", "An account with this email already exists.");
  }

  const pinHash = await bcrypt.hash(input.pin, BCRYPT_ROUNDS);
  const created = await repo.create(email, pinHash);
  if (created.kind === "conflict") {
    return fail("email_taken", "An account with this email already exists.");
  }
  if (created.kind === "error") {
    return fail("server_error", "Could not create your account.");
  }

  await repo.ensureSettings(created.id);
  return { ok: true, userId: created.id, sessionVersion: created.session_version };
}

export async function login(
  input: { email: string; pin: string },
  repo: UsersRepo,
  now: number = Date.now(),
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email) || !isSixDigits(input.pin)) {
    return fail("invalid_credentials", "Incorrect email or PIN.");
  }

  const user = await repo.findByEmail(email);
  if (user === "error") {
    return fail("server_error", "Something went wrong. Please try again.");
  }
  if (!user) {
    // Constant-ish time: still run a compare against a dummy hash.
    await bcrypt.compare(input.pin, DUMMY_HASH);
    return fail("invalid_credentials", "Incorrect email or PIN.");
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > now) {
    return fail("account_locked", "Too many attempts. Try again later.", user.locked_until);
  }

  const matches = await bcrypt.compare(input.pin, user.pin_hash);
  if (!matches) {
    const attempts = user.failed_attempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(now + LOCK_MINUTES * 60_000).toISOString()
      : null;
    await repo.setAuthState(user.id, {
      failed_attempts: shouldLock ? 0 : attempts,
      locked_until: lockedUntil,
    });
    if (shouldLock) {
      return fail(
        "account_locked",
        "Too many attempts. Try again in 15 minutes.",
        lockedUntil ?? undefined,
      );
    }
    return fail("invalid_credentials", "Incorrect email or PIN.");
  }

  if (user.failed_attempts !== 0 || user.locked_until) {
    await repo.setAuthState(user.id, { failed_attempts: 0, locked_until: null });
  }
  return { ok: true, userId: user.id, sessionVersion: user.session_version };
}

export async function revokeAllSessions(
  userId: string,
  repo: UsersRepo,
): Promise<void> {
  const current = await repo.getSessionVersion(userId);
  await repo.setSessionVersion(userId, (current ?? 0) + 1);
}

export const authConstants = {
  BCRYPT_ROUNDS,
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
};
