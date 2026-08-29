import { randomBytes, createHash } from "node:crypto";

/**
 * PIN-recovery token generation/hashing. Pure — no I/O — so it's fully
 * unit-testable. The raw token is emailed to the user and never stored;
 * only its SHA-256 hash is persisted, so a database leak alone can't be
 * used to reset a PIN.
 */
export const RECOVERY_TOKEN_BYTES = 32;
export const RECOVERY_TOKEN_TTL_MINUTES = 15;

export function generateRecoveryToken(): string {
  return randomBytes(RECOVERY_TOKEN_BYTES).toString("base64url");
}

export function hashRecoveryToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
