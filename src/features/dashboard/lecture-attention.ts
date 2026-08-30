import type { LectureStatus } from "@/lib/supabase/types";

export type AttentionKind = "action" | "processing";

/** Lectures worth surfacing on the dashboard: ones that need a retry
 * ("action" — student can do something) or are still in the pipeline
 * ("processing" — informational only). Completed/recording/uploaded
 * lectures need no attention and are excluded upstream. */
const ACTION_STATUSES: readonly LectureStatus[] = ["failed", "recoverable"];
const PROCESSING_STATUSES: readonly LectureStatus[] = [
  "uploading",
  "transcribing",
  "transcribed",
  "analyzing",
  "finalizing",
];

export const ATTENTION_STATUSES: readonly LectureStatus[] = [
  ...ACTION_STATUSES,
  ...PROCESSING_STATUSES,
];

export function classifyLectureAttention(status: LectureStatus): AttentionKind | null {
  if (ACTION_STATUSES.includes(status)) return "action";
  if (PROCESSING_STATUSES.includes(status)) return "processing";
  return null;
}

/** Sort key so actionable (failed/recoverable) lectures surface before
 * merely-processing ones — a student can act on the former, not the latter. */
export function attentionRank(status: LectureStatus): number {
  return classifyLectureAttention(status) === "action" ? 0 : 1;
}
