import { describe, it, expect } from "vitest";
import {
  hasCurrentRecordingConsent,
  withRecordingConsent,
  RECORDING_CONSENT_VERSION,
} from "./recording-consent";

describe("hasCurrentRecordingConsent", () => {
  it("is false for missing/empty/malformed prefs", () => {
    expect(hasCurrentRecordingConsent(null)).toBe(false);
    expect(hasCurrentRecordingConsent(undefined)).toBe(false);
    expect(hasCurrentRecordingConsent({})).toBe(false);
    expect(hasCurrentRecordingConsent("not an object")).toBe(false);
    expect(hasCurrentRecordingConsent({ consent: "not an object" })).toBe(false);
  });

  it("is true once the current version's consent is recorded", () => {
    expect(
      hasCurrentRecordingConsent({
        consent: { version: RECORDING_CONSENT_VERSION, consentedAt: "2026-01-01T00:00:00Z" },
      }),
    ).toBe(true);
  });

  it("is false for a stale consent version (policy changed, must re-consent)", () => {
    expect(
      hasCurrentRecordingConsent({
        consent: { version: RECORDING_CONSENT_VERSION - 1, consentedAt: "2020-01-01T00:00:00Z" },
      }),
    ).toBe(false);
  });
});

describe("withRecordingConsent", () => {
  it("stamps the current version and timestamp", () => {
    const result = withRecordingConsent({}, "2026-01-01T00:00:00Z");
    expect(result.consent).toEqual({
      version: RECORDING_CONSENT_VERSION,
      consentedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("preserves other existing keys in recording_prefs", () => {
    const result = withRecordingConsent({ someOtherPref: true }, "2026-01-01T00:00:00Z");
    expect(result.someOtherPref).toBe(true);
    expect(result.consent).toBeTruthy();
  });

  it("tolerates non-object existing prefs", () => {
    const result = withRecordingConsent(null, "2026-01-01T00:00:00Z");
    expect(result.consent).toBeTruthy();
  });
});
