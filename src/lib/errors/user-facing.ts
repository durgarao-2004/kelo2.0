/**
 * Maps internal processing failures (raw provider/HTTP diagnostics — status
 * codes, response bodies, timeout messages) to a clean, generic message safe
 * to show a user. The raw detail is still persisted (e.g. `lectures.error`)
 * for the account owner's own retry context and server-side diagnosis; it
 * must never be the thing rendered directly in the UI.
 */
export function toUserFacingProcessingError(_rawError: string | null | undefined): string {
  return "Transcription is temporarily unavailable. Please retry processing.";
}

/** Same principle as above, for AI-answer/analysis failures outside the
 * recording pipeline (e.g. "Ask my lectures"). */
export function toUserFacingAiError(_rawError: string | null | undefined): string {
  return "This AI feature is temporarily unavailable. Please try again.";
}
