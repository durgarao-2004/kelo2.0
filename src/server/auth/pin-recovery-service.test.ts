import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { requestPinRecovery, resetPinWithToken } from "./pin-recovery-service";
import type { UserAuthRow, UsersRepo, CreateUserResult } from "./users-repo";
import type {
  CreateRecoveryTokenInput,
  PinRecoveryRepo,
  RecoveryTokenRow,
} from "./pin-recovery-repo";

interface StoredUser extends UserAuthRow {
  email: string;
}

function makeUsersRepo() {
  const byId = new Map<string, StoredUser>();
  let counter = 0;
  const find = (email: string) => [...byId.values()].find((u) => u.email === email) ?? null;

  const repo: UsersRepo = {
    async findByEmail(email) {
      const u = find(email);
      return u ? { ...u } : null;
    },
    async existsByEmail(email) {
      return Boolean(find(email));
    },
    async create(email, pinHash): Promise<CreateUserResult> {
      if (find(email)) return { kind: "conflict" };
      const id = `u${++counter}`;
      byId.set(id, {
        id,
        email,
        pin_hash: pinHash,
        failed_attempts: 0,
        locked_until: null,
        session_version: 0,
      });
      return { kind: "created", id, session_version: 0 };
    },
    async setAuthState(id, state) {
      const u = byId.get(id);
      if (u) Object.assign(u, state);
    },
    async ensureSettings() {},
    async getSessionVersion(id) {
      return byId.get(id)?.session_version ?? null;
    },
    async setSessionVersion(id, v) {
      const u = byId.get(id);
      if (u) u.session_version = v;
    },
    async setPinHash(id, pinHash) {
      const u = byId.get(id);
      if (u) u.pin_hash = pinHash;
    },
  };

  return { repo, byId };
}

function makeRecoveryRepo() {
  const rows = new Map<string, RecoveryTokenRow & { createdAtIso: string }>();
  let counter = 0;
  const created: CreateRecoveryTokenInput[] = [];

  const repo: PinRecoveryRepo = {
    async countRecentRequests(userId, sinceIso) {
      return [...rows.values()].filter(
        (r) => r.userId === userId && r.createdAtIso >= sinceIso,
      ).length;
    },
    async createToken(input) {
      created.push(input);
      const id = `t${++counter}`;
      rows.set(id, {
        id,
        userId: input.userId,
        expiresAt: input.expiresAt,
        usedAt: null,
        createdAtIso: new Date().toISOString(),
      });
      // store hash -> id lookup via a side map
      hashToId.set(input.tokenHash, id);
    },
    async findValidToken(tokenHash, nowIso) {
      const id = hashToId.get(tokenHash);
      if (!id) return null;
      const row = rows.get(id);
      if (!row) return null;
      if (row.usedAt) return null;
      if (row.expiresAt <= nowIso) return null;
      return { ...row };
    },
    async markTokenUsed(tokenId) {
      const row = rows.get(tokenId);
      if (row) row.usedAt = new Date().toISOString();
    },
  };
  const hashToId = new Map<string, string>();

  return { repo, rows, created };
}

const goodEmail = "Ada@Uni.EDU";

async function setupUser() {
  const users = makeUsersRepo();
  const id = `u1`;
  users.byId.set(id, {
    id,
    email: "ada@uni.edu",
    pin_hash: await bcrypt.hash("284915", 4),
    failed_attempts: 0,
    locked_until: null,
    session_version: 0,
  });
  return users;
}

describe("requestPinRecovery", () => {
  it("does nothing (but still reports ok) for an unregistered email", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const sendEmail = vi.fn(async (_input: { to: string; resetUrl: string }) => {});

    const res = await requestPinRecovery(
      { email: "ghost@uni.edu", resetUrlBase: "https://kelo.app/reset-pin" },
      users.repo,
      recovery.repo,
      sendEmail,
    );

    expect(res.ok).toBe(true);
    expect(recovery.created).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("creates a hashed token and emails a link containing the raw token", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const sendEmail = vi.fn(async (_input: { to: string; resetUrl: string }) => {});

    await requestPinRecovery(
      { email: goodEmail, resetUrlBase: "https://kelo.app/reset-pin" },
      users.repo,
      recovery.repo,
      sendEmail,
    );

    expect(recovery.created).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledOnce();
    const { to, resetUrl } = sendEmail.mock.calls[0][0];
    expect(to).toBe("ada@uni.edu");
    const rawToken = new URL(resetUrl).searchParams.get("token")!;
    expect(rawToken.length).toBeGreaterThan(20);
    // The stored hash must NOT be (nor contain) the raw token.
    expect(recovery.created[0].tokenHash).not.toContain(rawToken);
    expect(recovery.created[0].tokenHash).not.toBe(rawToken);
  });

  it("rate-limits after 3 requests in the window without erroring", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const sendEmail = vi.fn(async (_input: { to: string; resetUrl: string }) => {});
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      await requestPinRecovery(
        { email: goodEmail, resetUrlBase: "https://kelo.app/reset-pin" },
        users.repo,
        recovery.repo,
        sendEmail,
        now,
      );
    }
    expect(sendEmail).toHaveBeenCalledTimes(3);

    const res = await requestPinRecovery(
      { email: goodEmail, resetUrlBase: "https://kelo.app/reset-pin" },
      users.repo,
      recovery.repo,
      sendEmail,
      now,
    );
    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(3); // still 3 — the 4th was suppressed
  });
});

describe("resetPinWithToken", () => {
  it("rejects a malformed/garbage token", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const res = await resetPinWithToken(
      { token: "not-a-real-token", pin: "581274", confirmPin: "581274" },
      users.repo,
      recovery.repo,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_token");
  });

  it("rejects a weak or mismatched PIN before touching the token", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const sendEmail = vi.fn(async (_input: { to: string; resetUrl: string }) => {});
    await requestPinRecovery(
      { email: goodEmail, resetUrlBase: "https://kelo.app/reset-pin" },
      users.repo,
      recovery.repo,
      sendEmail,
    );
    const rawToken = new URL(sendEmail.mock.calls[0][0].resetUrl).searchParams.get("token")!;

    const weak = await resetPinWithToken(
      { token: rawToken, pin: "123456", confirmPin: "123456" },
      users.repo,
      recovery.repo,
    );
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.code).toBe("weak_pin");

    const mismatch = await resetPinWithToken(
      { token: rawToken, pin: "581274", confirmPin: "581275" },
      users.repo,
      recovery.repo,
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe("pin_mismatch");
  });

  it("resets the PIN, invalidates the token, and bumps the session version", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const sendEmail = vi.fn(async (_input: { to: string; resetUrl: string }) => {});
    await requestPinRecovery(
      { email: goodEmail, resetUrlBase: "https://kelo.app/reset-pin" },
      users.repo,
      recovery.repo,
      sendEmail,
    );
    const rawToken = new URL(sendEmail.mock.calls[0][0].resetUrl).searchParams.get("token")!;

    const res = await resetPinWithToken(
      { token: rawToken, pin: "581274", confirmPin: "581274" },
      users.repo,
      recovery.repo,
    );
    expect(res.ok).toBe(true);

    const stored = users.byId.get("u1")!;
    expect(await bcrypt.compare("581274", stored.pin_hash)).toBe(true);
    expect(await bcrypt.compare("284915", stored.pin_hash)).toBe(false);
    expect(stored.session_version).toBe(1); // every existing session invalidated
  });

  it("rejects reusing an already-consumed token (single-use)", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const sendEmail = vi.fn(async (_input: { to: string; resetUrl: string }) => {});
    await requestPinRecovery(
      { email: goodEmail, resetUrlBase: "https://kelo.app/reset-pin" },
      users.repo,
      recovery.repo,
      sendEmail,
    );
    const rawToken = new URL(sendEmail.mock.calls[0][0].resetUrl).searchParams.get("token")!;

    const first = await resetPinWithToken(
      { token: rawToken, pin: "581274", confirmPin: "581274" },
      users.repo,
      recovery.repo,
    );
    expect(first.ok).toBe(true);

    const second = await resetPinWithToken(
      { token: rawToken, pin: "748213", confirmPin: "748213" },
      users.repo,
      recovery.repo,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("invalid_token");
  });

  it("rejects an expired token", async () => {
    const users = await setupUser();
    const recovery = makeRecoveryRepo();
    const sendEmail = vi.fn(async (_input: { to: string; resetUrl: string }) => {});
    const now = Date.now();
    await requestPinRecovery(
      { email: goodEmail, resetUrlBase: "https://kelo.app/reset-pin" },
      users.repo,
      recovery.repo,
      sendEmail,
      now,
    );
    const rawToken = new URL(sendEmail.mock.calls[0][0].resetUrl).searchParams.get("token")!;

    const later = now + 16 * 60_000; // token TTL is 15 minutes
    const res = await resetPinWithToken(
      { token: rawToken, pin: "581274", confirmPin: "581274" },
      users.repo,
      recovery.repo,
      later,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_token");
  });
});
