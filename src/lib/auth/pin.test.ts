import { describe, it, expect } from "vitest";
import { validatePin, pinsMatch, isSixDigits } from "./pin";

describe("validatePin", () => {
  it("accepts a strong 6-digit PIN", () => {
    expect(validatePin("284915")).toEqual({ valid: true });
    expect(validatePin("607192")).toEqual({ valid: true });
  });

  it("rejects wrong length or non-digits", () => {
    for (const bad of ["12345", "1234567", "12a456", "", "abcdef", " 12345"]) {
      expect(validatePin(bad).valid).toBe(false);
    }
  });

  it("rejects all-same-digit PINs", () => {
    for (const bad of ["000000", "111111", "999999"]) {
      expect(validatePin(bad).valid).toBe(false);
    }
  });

  it("rejects ascending and descending sequences", () => {
    expect(validatePin("123456").valid).toBe(false);
    expect(validatePin("234567").valid).toBe(false);
    expect(validatePin("987654").valid).toBe(false);
    expect(validatePin("654321").valid).toBe(false);
  });

  it("rejects repeating patterns (ABABAB / ABCABC)", () => {
    expect(validatePin("121212").valid).toBe(false);
    expect(validatePin("123123").valid).toBe(false);
    expect(validatePin("454545").valid).toBe(false);
  });

  it("rejects common PINs from the blocklist", () => {
    expect(validatePin("789456").valid).toBe(false);
    expect(validatePin("159753").valid).toBe(false);
  });

  it("gives a human-readable reason on failure", () => {
    const r = validatePin("111111");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason.length).toBeGreaterThan(3);
  });
});

describe("pinsMatch", () => {
  it("is true only when both are equal 6-digit strings", () => {
    expect(pinsMatch("284915", "284915")).toBe(true);
    expect(pinsMatch("284915", "284916")).toBe(false);
    expect(pinsMatch("2849", "2849")).toBe(false);
  });
});

describe("isSixDigits", () => {
  it("checks shape only", () => {
    expect(isSixDigits("000000")).toBe(true);
    expect(isSixDigits("12345")).toBe(false);
    expect(isSixDigits("12345a")).toBe(false);
  });
});
