import { describe, it, expect } from "vitest";
import { signup, login, revokeAllSessions } from "./service";
import type { UserAuthRow, UsersRepo, CreateUserResult } from "./users-repo";

interface Stored extends UserAuthRow {
  email: string;
}

function makeMemoryRepo() {
  const byId = new Map<string, Stored>();
  let counter = 0;

  const find = (email: string) =>
    [...byId.values()].find((u) => u.email === email) ?? null;

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
  };

  return { repo, byId };
}

const good = { email: "Ada@Uni.EDU", pin: "284915", confirmPin: "284915" };

describe("signup", () => {
  it("creates an account, lowercases email, hashes the PIN", async () => {
    const { repo, byId } = makeMemoryRepo();
    const res = await signup(good, repo);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const stored = byId.get(res.userId)!;
      expect(stored.email).toBe("ada@uni.edu");
      expect(stored.pin_hash).not.toContain("284915");
      expect(stored.pin_hash.startsWith("$2")).toBe(true);
      expect(res.sessionVersion).toBe(0);
    }
  });

  it("rejects invalid email, weak PIN, and mismatch", async () => {
    const { repo } = makeMemoryRepo();
    expect((await signup({ ...good, email: "nope" }, repo)).ok).toBe(false);
    expect(
      (await signup({ email: "a@b.co", pin: "123456", confirmPin: "123456" }, repo)).ok,
    ).toBe(false);
    expect(
      (await signup({ email: "a@b.co", pin: "284915", confirmPin: "284916" }, repo)).ok,
    ).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    const { repo } = makeMemoryRepo();
    await signup(good, repo);
    const dup = await signup(good, repo);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.code).toBe("email_taken");
  });

  it("propagates repository errors as server_error", async () => {
    const repo = makeMemoryRepo().repo;
    repo.existsByEmail = async () => "error";
    const res = await signup(good, repo);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("server_error");
  });
});

describe("login", () => {
  it("succeeds with correct credentials", async () => {
    const { repo } = makeMemoryRepo();
    await signup(good, repo);
    const res = await login({ email: "ada@uni.edu", pin: "284915" }, repo);
    expect(res.ok).toBe(true);
  });

  it("does not leak whether the email exists", async () => {
    const { repo } = makeMemoryRepo();
    const res = await login({ email: "ghost@uni.edu", pin: "284915" }, repo);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_credentials");
  });

  it("increments failed attempts on wrong PIN", async () => {
    const { repo, byId } = makeMemoryRepo();
    const s = await signup(good, repo);
    if (!s.ok) throw new Error("setup");
    await login({ email: "ada@uni.edu", pin: "999999" }, repo);
    expect(byId.get(s.userId)!.failed_attempts).toBe(1);
  });

  it("locks the account after 5 failed attempts", async () => {
    const { repo, byId } = makeMemoryRepo();
    const s = await signup(good, repo);
    if (!s.ok) throw new Error("setup");
    let last;
    for (let i = 0; i < 5; i++) {
      last = await login({ email: "ada@uni.edu", pin: "999999" }, repo);
    }
    expect(last!.ok).toBe(false);
    if (last && !last.ok) expect(last.code).toBe("account_locked");
    // Even a correct PIN is rejected while locked.
    const now = Date.now();
    const during = await login({ email: "ada@uni.edu", pin: "284915" }, repo, now);
    expect(during.ok).toBe(false);
    if (!during.ok) expect(during.code).toBe("account_locked");
    expect(byId.get(s.userId)!.locked_until).toBeTruthy();
  });

  it("allows login again after the lock window expires", async () => {
    const { repo } = makeMemoryRepo();
    await signup(good, repo);
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await login({ email: "ada@uni.edu", pin: "999999" }, repo, base);
    }
    // 16 minutes later (> 15 min lock)
    const later = base + 16 * 60_000;
    const res = await login({ email: "ada@uni.edu", pin: "284915" }, repo, later);
    expect(res.ok).toBe(true);
  });

  it("resets failed attempts after a successful login", async () => {
    const { repo, byId } = makeMemoryRepo();
    const s = await signup(good, repo);
    if (!s.ok) throw new Error("setup");
    await login({ email: "ada@uni.edu", pin: "999999" }, repo);
    await login({ email: "ada@uni.edu", pin: "284915" }, repo);
    expect(byId.get(s.userId)!.failed_attempts).toBe(0);
  });
});

describe("revokeAllSessions", () => {
  it("bumps the session version", async () => {
    const { repo, byId } = makeMemoryRepo();
    const s = await signup(good, repo);
    if (!s.ok) throw new Error("setup");
    await revokeAllSessions(s.userId, repo);
    expect(byId.get(s.userId)!.session_version).toBe(1);
  });
});
