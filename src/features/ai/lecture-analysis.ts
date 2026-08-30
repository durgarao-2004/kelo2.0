import type { Flashcard, Definition, NoteSection } from "./parse";

/**
 * Shape of one AI analysis pass over a lecture transcript. Kept in a
 * server-only-free module (unlike server/ai/tasks.ts) so the empty-transcript
 * guard below is directly unit-testable.
 */
export interface LectureAnalysis {
  title: string;
  summary: string;
  keyConcepts: string[];
  importantPoints: string[];
  topics: string[];
  notes: NoteSection[];
  definitions: Definition[];
  examples: string[];
  revision: {
    examQuestions: string[];
    flashcards: Flashcard[];
    quickReview: string[];
  };
  provider: string;
  model: string;
}

/**
 * Flatten an analysis into one search-friendly text blob. This is what
 * actually gets indexed for full-text search (see server/search/index-lecture.ts)
 * — without it, only the transcript and the short summary paragraph are
 * searchable, so a student searching for a definition, an example, or a
 * revision point the AI generated would silently find nothing even though
 * it's right there on the lecture page. Purely a text projection — invents
 * nothing, just surfaces content that already exists.
 */
export function buildSearchableSummaryText(analysis: LectureAnalysis): string {
  const parts: string[] = [];
  if (analysis.summary) parts.push(analysis.summary);
  if (analysis.keyConcepts.length) parts.push(`Key concepts: ${analysis.keyConcepts.join(", ")}`);
  for (const d of analysis.definitions) parts.push(`${d.term}: ${d.definition}`);
  if (analysis.examples.length) parts.push(`Examples: ${analysis.examples.join(". ")}`);
  if (analysis.importantPoints.length) {
    parts.push(`Important points: ${analysis.importantPoints.join(". ")}`);
  }
  for (const section of analysis.notes) {
    parts.push(`${section.heading}: ${section.points.join(". ")}`);
  }
  if (analysis.revision.quickReview.length) {
    parts.push(`Quick review: ${analysis.revision.quickReview.join(". ")}`);
  }
  if (analysis.revision.examQuestions.length) {
    parts.push(`Exam questions: ${analysis.revision.examQuestions.join(" ")}`);
  }
  for (const card of analysis.revision.flashcards) parts.push(`${card.q} ${card.a}`);
  return parts.join("\n\n");
}

/** No AI call for a blank transcript — an empty prompt risks the model
 * fabricating a plausible-sounding lecture out of nothing, which is exactly
 * what must never happen. */
export function emptyLectureAnalysis(subjectName: string): LectureAnalysis {
  return {
    title: `${subjectName} lecture`,
    summary: "",
    keyConcepts: [],
    importantPoints: [],
    topics: [],
    notes: [],
    definitions: [],
    examples: [],
    revision: { examQuestions: [], flashcards: [], quickReview: [] },
    provider: "none",
    model: "none",
  };
}
