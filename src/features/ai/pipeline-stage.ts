/**
 * Pure decision logic for the transcription/analysis pipeline — kept free of
 * any Supabase/network calls so "resume from the right stage" and "is this a
 * duplicate/concurrent run" are both directly unit-testable.
 */
export type PipelineStage = "transcribe" | "analyze" | "finalize";

/**
 * Where should a (re)run pick up? Driven by what's actually persisted, not
 * just the lecture's status string, so a retry always continues from the
 * last stage that actually succeeded instead of redoing paid work.
 */
export function resumeStage(hasTranscript: boolean, hasSummary: boolean): PipelineStage {
  if (!hasTranscript) return "transcribe";
  if (!hasSummary) return "analyze";
  return "finalize";
}

export const IN_FLIGHT_STATUSES = ["transcribing", "analyzing", "finalizing"] as const;
export type InFlightStatus = (typeof IN_FLIGHT_STATUSES)[number];

export function isInFlightStatus(status: string): status is InFlightStatus {
  return (IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

/**
 * May a new run claim this lecture? Refuses while a run is genuinely in
 * flight (prevents duplicate concurrent processing / duplicate Drive files),
 * but still allows reclaiming a run that's been stuck past `staleMs` — e.g.
 * the server process was killed mid-request — so a crash can never
 * permanently wedge a lecture in "Transcribing" forever with no way to retry.
 */
export function canClaim(
  status: string,
  updatedAtMs: number,
  nowMs: number,
  staleMs: number,
): boolean {
  if (!isInFlightStatus(status)) return true;
  return nowMs - updatedAtMs > staleMs;
}

/** In-flight status to claim for a given resume stage. */
export function claimStatusFor(stage: PipelineStage): InFlightStatus {
  if (stage === "transcribe") return "transcribing";
  if (stage === "analyze") return "analyzing";
  return "finalizing";
}
