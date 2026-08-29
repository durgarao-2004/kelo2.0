import { describe, it, expect } from "vitest";
import { generateRecoveryToken, hashRecoveryToken } from "./recovery-token";

describe("generateRecoveryToken", () => {
  it("produces long, URL-safe, unique tokens", () => {
    const a = generateRecoveryToken();
    const b = generateRecoveryToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashRecoveryToken", () => {
  it("is deterministic for the same input", () => {
    const token = generateRecoveryToken();
    expect(hashRecoveryToken(token)).toBe(hashRecoveryToken(token));
  });

  it("never contains or equals the raw token", () => {
    const token = generateRecoveryToken();
    const hash = hashRecoveryToken(token);
    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
  });

  it("produces a 64-char hex digest (sha256)", () => {
    expect(hashRecoveryToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different tokens", () => {
    expect(hashRecoveryToken("a")).not.toBe(hashRecoveryToken("b"));
  });
});
