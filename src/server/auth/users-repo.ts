/**
 * Repository boundary between auth business logic and the database.
 * The pure logic in service.ts depends only on this interface, so it can be
 * unit-tested with an in-memory fake and never needs a live Supabase.
 */
export interface UserAuthRow {
  id: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  session_version: number;
}

export type CreateUserResult =
  | { kind: "created"; id: string; session_version: number }
  | { kind: "conflict" }
  | { kind: "error" };

export interface UsersRepo {
  findByEmail(email: string): Promise<UserAuthRow | null | "error">;
  existsByEmail(email: string): Promise<boolean | "error">;
  create(email: string, pinHash: string): Promise<CreateUserResult>;
  setAuthState(
    id: string,
    state: { failed_attempts: number; locked_until: string | null },
  ): Promise<void>;
  ensureSettings(id: string): Promise<void>;
  getSessionVersion(id: string): Promise<number | null>;
  setSessionVersion(id: string, version: number): Promise<void>;
  setPinHash(id: string, pinHash: string): Promise<void>;
}
