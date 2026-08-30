/**
 * Recording-consent state stored in `user_settings.recording_prefs`. Pure
 * parsing/merging logic — the actual DB read/write lives in
 * server/settings/consent.ts.
 *
 * Bumping RECORDING_CONSENT_VERSION forces every user to see the consent
 * notice again next time they record (e.g. if the policy materially
 * changes) without needing a migration — old stored versions simply stop
 * matching.
 */
export const RECORDING_CONSENT_VERSION = 1;

export function hasCurrentRecordingConsent(recordingPrefs: unknown): boolean {
  if (!recordingPrefs || typeof recordingPrefs !== "object") return false;
  const consent = (recordingPrefs as { consent?: unknown }).consent;
  if (!consent || typeof consent !== "object") return false;
  const version = (consent as { version?: unknown }).version;
  return version === RECORDING_CONSENT_VERSION;
}

/** Merge a fresh consent record into existing recording_prefs, preserving
 * any other keys already stored there. */
export function withRecordingConsent(
  recordingPrefs: unknown,
  consentedAt: string,
): Record<string, unknown> {
  const base =
    recordingPrefs && typeof recordingPrefs === "object"
      ? (recordingPrefs as Record<string, unknown>)
      : {};
  return {
    ...base,
    consent: { version: RECORDING_CONSENT_VERSION, consentedAt },
  };
}
