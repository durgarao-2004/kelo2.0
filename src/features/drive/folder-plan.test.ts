import { describe, it, expect } from "vitest";
import {
  sanitizeSegment,
  subjectPathSegments,
  leafPathSegments,
  fullFolderPlan,
  pathString,
  LEAF_FOLDERS,
} from "./folder-plan";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";

describe("folder planning", () => {
  const input = { year: 2026, semester: "Semester 1", subject: "Data Science" };

  it("builds the subject path", () => {
    expect(subjectPathSegments(input)).toEqual([
      "KELO",
      "2026",
      "Semester 1",
      "Data Science",
    ]);
  });

  it("defaults year and semester when missing", () => {
    const segs = subjectPathSegments({ subject: "Physics" });
    expect(segs[0]).toBe("KELO");
    expect(segs[2]).toBe("General");
    expect(segs[3]).toBe("Physics");
    expect(Number(segs[1])).toBeGreaterThanOrEqual(2024);
  });

  it("sanitizes slashes and whitespace", () => {
    expect(sanitizeSegment("AI/ML  Lab")).toBe("AI-ML Lab");
    expect(sanitizeSegment("   ")).toBe("Untitled");
  });

  it("produces leaf paths for each subfolder", () => {
    expect(leafPathSegments(input, "Recordings")).toEqual([
      "KELO",
      "2026",
      "Semester 1",
      "Data Science",
      "Recordings",
    ]);
  });

  it("plans folders root-first, parents before children, with all leaves", () => {
    const plan = fullFolderPlan(input);
    const asStrings = plan.map(pathString);
    // Parent appears before child.
    expect(asStrings.indexOf("KELO")).toBeLessThan(
      asStrings.indexOf("KELO/2026"),
    );
    expect(asStrings.indexOf("KELO/2026/Semester 1")).toBeLessThan(
      asStrings.indexOf("KELO/2026/Semester 1/Data Science"),
    );
    // All three leaves present.
    for (const leaf of LEAF_FOLDERS) {
      expect(asStrings).toContain(`KELO/2026/Semester 1/Data Science/${leaf}`);
    }
    // 4 ancestors + 3 leaves = 7 entries.
    expect(plan).toHaveLength(7);
  });

  it("has no duplicate paths in a plan", () => {
    const asStrings = fullFolderPlan(input).map(pathString);
    expect(new Set(asStrings).size).toBe(asStrings.length);
  });
});

describe("token encryption", () => {
  process.env.SESSION_SECRET =
    "test-session-secret-that-is-definitely-long-enough-1234567890";

  it("round-trips a token", () => {
    const secret = "ya29.a0AfB_byC-some-refresh-token-value";
    const enc = encryptToken(secret);
    expect(enc).not.toContain(secret);
    expect(decryptToken(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("throws on tampered ciphertext", () => {
    const enc = encryptToken("hello");
    const parts = enc.split(".");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => decryptToken(parts.join("."))).toThrow();
  });
});
