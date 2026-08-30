import { describe, it, expect } from "vitest";
import { emptyLectureAnalysis } from "./lecture-analysis";

describe("emptyLectureAnalysis", () => {
  it("returns an honest, empty result rather than fabricating content", () => {
    const result = emptyLectureAnalysis("Thermodynamics");
    expect(result).toEqual({
      title: "Thermodynamics lecture",
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
    });
  });
});
