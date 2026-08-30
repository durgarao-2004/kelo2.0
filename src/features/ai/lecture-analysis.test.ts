import { describe, it, expect } from "vitest";
import { emptyLectureAnalysis, buildSearchableSummaryText, type LectureAnalysis } from "./lecture-analysis";

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

describe("buildSearchableSummaryText", () => {
  it("includes every field that generated content lives in", () => {
    const analysis: LectureAnalysis = {
      title: "NPV",
      summary: "The lecture covered capital budgeting.",
      keyConcepts: ["Net Present Value"],
      importantPoints: ["NPV must be positive to accept a project."],
      topics: ["Finance"],
      notes: [{ heading: "Capital Budgeting", points: ["Discounts future cash flows."] }],
      definitions: [{ term: "NPV", definition: "Net present value of cash flows." }],
      examples: ["A machine costing $10,000 with future returns."],
      revision: {
        examQuestions: ["Explain NPV."],
        flashcards: [{ q: "What is NPV?", a: "Discounted cash flow value." }],
        quickReview: ["NPV > 0 means accept."],
      },
      provider: "gemini",
      model: "gemini-2.5-flash",
    };
    const text = buildSearchableSummaryText(analysis);
    expect(text).toContain("capital budgeting");
    expect(text).toContain("Net Present Value");
    expect(text).toContain("NPV must be positive");
    expect(text).toContain("Capital Budgeting: Discounts future cash flows.");
    expect(text).toContain("NPV: Net present value of cash flows.");
    expect(text).toContain("A machine costing $10,000");
    expect(text).toContain("NPV > 0 means accept.");
    expect(text).toContain("Explain NPV.");
    expect(text).toContain("What is NPV?");
  });

  it("produces an empty string for a blank analysis rather than throwing", () => {
    expect(buildSearchableSummaryText(emptyLectureAnalysis("Physics"))).toBe("");
  });

  it("never invents content — output is a strict subset built only from provided fields", () => {
    const analysis: LectureAnalysis = {
      ...emptyLectureAnalysis("Physics"),
      summary: "Only a summary was generated.",
    };
    expect(buildSearchableSummaryText(analysis)).toBe("Only a summary was generated.");
  });
});
