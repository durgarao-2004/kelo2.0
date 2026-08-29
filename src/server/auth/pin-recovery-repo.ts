/**
 * Repository boundary for PIN-recovery tokens. Mirrors the split in
 * users-repo.ts: pure logic in pin-recovery-service.ts depends only on this
 * interface, so it's unit-testable with an in-memory fake and never needs a
 * live Supabase.
 */
export interface CreateRecoveryTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: string; // ISO
}

export interface RecoveryTokenRow {
  id: string;
  userId: string;
  expiresAt: string; // ISO
  usedAt: string | null;
}

export interface PinRecoveryRepo {
  /** Count non-expired-window requests for rate limiting (regardless of use). */
  countRecentRequests(userId: string, sinceIso: string): Promise<number>;
  createToken(input: CreateRecoveryTokenInput): Promise<void>;
  /** Returns the token row only if it exists, is unused, and hasn't expired. */
  findValidToken(tokenHash: string, nowIso: string): Promise<RecoveryTokenRow | null>;
  markTokenUsed(tokenId: string): Promise<void>;
}
