import type { RetrievedChunk } from "@/server/search/retrieve";
import type { AcademicReferenceHit } from "@/server/search/textbook-concepts";

/**
 * Merge the two independent lookups behind "Ask my lectures": required
 * lecture chunks (the actual RAG context — a failure here is a real error)
 * and optional academic references (a best-effort enrichment — a failure
 * here must never break the answer, it just means no textbook references
 * are shown this time).
 *
 * The two lists are deliberately kept separate, never deduplicated against
 * each other even when they reference the same lecture — lecture content
 * and textbook content are different sources and must stay distinguishable
 * in the result exactly as they do in the UI.
 */
export interface AskLookupOutcome<T> {
  data: T[];
  error: string | null;
}

export interface CombinedAskContext {
  chunks: RetrievedChunk[];
  /** Empty error → the lookup that failed is not surfaced as a user-facing
   * error; only `chunksError` can fail the overall request. */
  academicReferences: AcademicReferenceHit[];
  chunksError: string | null;
}

export function combineAskContext(
  chunksOutcome: AskLookupOutcome<RetrievedChunk>,
  academicOutcome: AskLookupOutcome<AcademicReferenceHit>,
): CombinedAskContext {
  return {
    chunks: chunksOutcome.data,
    // Fail open: an academic-reference lookup problem degrades gracefully to
    // "no references this time" rather than blocking the lecture-grounded
    // answer, which is the part the feature actually depends on.
    academicReferences: academicOutcome.error ? [] : academicOutcome.data,
    chunksError: chunksOutcome.error,
  };
}
