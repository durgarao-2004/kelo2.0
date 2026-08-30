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
