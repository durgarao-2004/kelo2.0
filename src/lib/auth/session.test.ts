import { describe, it, expect, beforeAll } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
} from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET =
    "test-session-secret-that-is-definitely-long-enough-1234567890";
});

describe("session tokens", () => {
  it("round-trips a valid payload", async () => {
    const token = await createSessionToken({ sub: "user-1", sv: 3 });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ sub: "user-1", sv: 3 });
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({ sub: "user-1", sv: 0 });
    const tampered = token.slice(0, -3) + "aaa";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects empty/undefined tokens", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken({ sub: "user-1", sv: 0 }, -10);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({ sub: "user-1", sv: 0 });
    process.env.SESSION_SECRET =
      "a-completely-different-secret-value-still-long-enough-000";
    expect(await verifySessionToken(token)).toBeNull();
    // restore for other tests
    process.env.SESSION_SECRET =
      "test-session-secret-that-is-definitely-long-enough-1234567890";
  });

  it("exposes a stable cookie name", () => {
    expect(SESSION_COOKIE).toBe("kelo_session");
  });
});
