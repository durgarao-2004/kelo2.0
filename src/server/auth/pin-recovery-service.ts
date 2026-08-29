import bcrypt from "bcryptjs";
import { validatePin, pinsMatch, isSixDigits } from "@/lib/auth/pin";
import {
  generateRecoveryToken,
  hashRecoveryToken,
  RECOVERY_TOKEN_TTL_MINUTES,
} from "@/lib/auth/recovery-token";
import { normalizeEmail, isValidEmail, authConstants, revokeAllSessions } from "./service";
import type { UsersRepo } from "./users-repo";
import type { PinRecoveryRepo } from "./pin-recovery-repo";

const MAX_RECOVERY_REQUESTS_PER_WINDOW = 3;
const RECOVERY_WINDOW_MINUTES = 60;

export type SendRecoveryEmail = (input: {
  to: string;
  resetUrl: string;
}) => Promise<void>;

/**
 * Always resolves the same way regardless of whether the email is registered,
 * rate-limited, or the send itself failed — the caller shows one generic
 * "check your email" message either way, so a response never reveals whether
 * an account exists (enumeration protection).
 */
export async function requestPinRecovery(
  input: { email: string; resetUrlBase: string },
  usersRepo: UsersRepo,
  recoveryRepo: PinRecoveryRepo,
  sendEmail: SendRecoveryEmail,
  now: number = Date.now(),
): Promise<{ ok: true }> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: true };

  const user = await usersRepo.findByEmail(email);
  if (user === "error" || !user) return { ok: true };

  const windowStart = new Date(now - RECOVERY_WINDOW_MINUTES * 60_000).toISOString();
  const recentCount = await recoveryRepo.countRecentRequests(user.id, windowStart);
  if (recentCount >= MAX_RECOVERY_REQUESTS_PER_WINDOW) return { ok: true };

  const token = generateRecoveryToken();
  const tokenHash = hashRecoveryToken(token);
  const expiresAt = new Date(now + RECOVERY_TOKEN_TTL_MINUTES * 60_000).toISOString();
  await recoveryRepo.createToken({ userId: user.id, tokenHash, expiresAt });

  const resetUrl = `${input.resetUrlBase}?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: email, resetUrl });

  return { ok: true };
}

export type ResetPinErrorCode =
  | "invalid_token"
  | "invalid_pin"
  | "pin_mismatch"
  | "weak_pin";

export interface ResetPinSuccess {
  ok: true;
}
export interface ResetPinFailure {
  ok: false;
  code: ResetPinErrorCode;
  message: string;
}
export type ResetPinResult = ResetPinSuccess | ResetPinFailure;

const INVALID_TOKEN: ResetPinFailure = {
  ok: false,
  code: "invalid_token",
  message: "This reset link is invalid or has expired. Request a new one.",
};

/**
 * Validate a recovery token and set a new PIN. Single-use: the token is
 * marked used in the same flow that consumes it, and every existing session
 * is invalidated (so a PIN reset also signs the account out everywhere).
 */
export async function resetPinWithToken(
  input: { token: string; pin: string; confirmPin: string },
  usersRepo: UsersRepo,
  recoveryRepo: PinRecoveryRepo,
  now: number = Date.now(),
): Promise<ResetPinResult> {
  if (!input.token || input.token.length < 20) return INVALID_TOKEN;

  if (!isSixDigits(input.pin)) {
    return { ok: false, code: "invalid_pin", message: "PIN must be exactly 6 digits." };
  }
  if (!pinsMatch(input.pin, input.confirmPin)) {
    return { ok: false, code: "pin_mismatch", message: "The two PINs don’t match." };
  }
  const strength = validatePin(input.pin);
  if (!strength.valid) {
    return { ok: false, code: "weak_pin", message: strength.reason };
  }

  const tokenHash = hashRecoveryToken(input.token);
  const row = await recoveryRepo.findValidToken(tokenHash, new Date(now).toISOString());
  if (!row) return INVALID_TOKEN;

  const pinHash = await bcrypt.hash(input.pin, authConstants.BCRYPT_ROUNDS);
  await usersRepo.setPinHash(row.userId, pinHash);
  await recoveryRepo.markTokenUsed(row.id);
  await revokeAllSessions(row.userId, usersRepo);

  return { ok: true };
}
