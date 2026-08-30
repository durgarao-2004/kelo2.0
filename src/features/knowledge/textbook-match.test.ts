import { describe, it, expect } from "vitest";
import {
  matchSubjectToTextbook,
  matchConceptToTextbookTopic,
  matchConceptToTextbook,
  stripFabricatedSourceDetails,
} from "./textbook-match";

describe("TEST 1 — Financial Management concept maps to the Financial Management textbook", () => {
  it("maps 'Net Present Value' under subject 'FM' to Pandey's Financial Management", () => {
    const result = matchConceptToTextbook("FM", "Net Present Value");
    expect(result.status).toBe("verified");
    expect(result.textbook?.subjectKey).toBe("financial_management");
    expect(result.textbook?.authors).toContain("I. M. Pandey");
    expect(result.topic?.name).toBe("Net Present Value");
  });

  it("matches via a common abbreviation alias (NPV)", () => {
    const result = matchConceptToTextbook("Financial Management", "npv");
    expect(result.status).toBe("verified");
    expect(result.topic?.name).toBe("Net Present Value");
  });
});

describe("TEST 2 — an MIS concept maps to the MIS textbook", () => {
  it("maps 'ERP' under subject 'MIS' to Laudon & Laudon", () => {
    const result = matchConceptToTextbook("MIS", "ERP");
    expect(result.status).toBe("verified");
    expect(result.textbook?.subjectKey).toBe("mis");
    expect(result.textbook?.authors).toEqual(["Kenneth C. Laudon", "Jane P. Laudon"]);
    expect(result.topic?.name).toBe("Enterprise Systems");
  });
});

describe("TEST 3 — an OB concept maps to Organizational Behavior", () => {
  it("maps 'Leadership styles' under subject 'OB' to Robbins/Judge/Vohra", () => {
    const result = matchConceptToTextbook("OB", "Leadership styles");
    expect(result.status).toBe("verified");
    expect(result.textbook?.subjectKey).toBe("organizational_behavior");
    expect(result.textbook?.authors).toContain("Stephen P. Robbins");
  });
});

describe("TEST 4 — a Marketing concept maps to Marketing Management", () => {
  it("maps 'STP' under subject 'Marketing Management' to Kotler et al.", () => {
    const result = matchConceptToTextbook("Marketing Management", "STP");
    expect(result.status).toBe("verified");
    expect(result.textbook?.subjectKey).toBe("marketing_management");
    expect(result.topic?.name).toBe("Segmentation, Targeting, and Positioning");
  });
});

describe("TEST 5 — an Accounting concept maps to Financial and Managerial Accounting", () => {
  it("maps 'Balance Sheet' under subject 'AFM' (Accounts for Managers) to Warren/Jones/Tayler", () => {
    const result = matchConceptToTextbook("AFM", "Balance Sheet");
    expect(result.status).toBe("verified");
    expect(result.textbook?.subjectKey).toBe("accounting");
    expect(result.textbook?.authors).toContain("Carl S. Warren");
  });
});

describe("TEST 6 — a concept without verified evidence never receives a fabricated citation", () => {
  it("returns 'unverified' (not 'verified') for a concept that isn't a known topic", () => {
    const result = matchConceptToTextbook("FM", "Quantum entanglement in derivatives pricing");
    expect(result.status).toBe("unverified");
    // The textbook is still identified (so the UI can say "not found in this
    // book"), but no topic/citation is attached.
    expect(result.textbook?.subjectKey).toBe("financial_management");
    expect(result.topic).toBeNull();
  });
});

describe("TEST 7 — the AI cannot claim a page number the source doesn't provide", () => {
  it("strips page references from generated text unconditionally (no page data exists anywhere in the system)", () => {
    expect(stripFabricatedSourceDetails("See p. 452 for details.")).toBe("See for details.");
    expect(stripFabricatedSourceDetails("Discussed on pages 12-15 of the text.")).toBe(
      "Discussed on of the text.",
    );
    expect(stripFabricatedSourceDetails("As covered in Chapter 9.")).toBe("As covered in .");
  });

  it("leaves ordinary text with no page/chapter claims untouched", () => {
    const text = "Net present value discounts future cash flows to the present.";
    expect(stripFabricatedSourceDetails(text)).toBe(text);
  });
});

describe("TEST 8 — lecture content and textbook content remain structurally distinguishable", () => {
  it("matchConceptToTextbook never returns lecture-derived text — only the textbook side of the pairing", () => {
    const result = matchConceptToTextbook("FM", "Capital Budgeting");
    // The match result carries only textbook-side fields; callers are
    // responsible for keeping any lecture-derived blurb in a separate field
    // (see server/knowledge/ground-concepts.ts), never merged into this object.
    expect(Object.keys(result).sort()).toEqual(["status", "textbook", "topic"]);
  });
});

describe("TEST 9 — missing/unknown textbook configuration produces a safe result", () => {
  it("returns 'not_configured' for a subject with no textbook mapping at all", () => {
    const result = matchConceptToTextbook("Underwater Basket Weaving", "Some concept");
    expect(result.status).toBe("not_configured");
    expect(result.textbook).toBeNull();
    expect(result.topic).toBeNull();
  });

  it("returns 'pending' for a subject mapped to a not-yet-verified textbook", () => {
    const result = matchConceptToTextbook("Data Science", "Regression");
    expect(result.status).toBe("pending");
    expect(result.textbook?.subjectKey).toBe("data_science_for_managers");
    expect(result.topic).toBeNull();
  });
});

describe("matchSubjectToTextbook", () => {
  it("is case- and whitespace-insensitive", () => {
    expect(matchSubjectToTextbook("  fm  ")?.subjectKey).toBe("financial_management");
    expect(matchSubjectToTextbook("Financial Management")?.subjectKey).toBe(
      "financial_management",
    );
  });

  it("does not false-positive short abbreviations as substrings", () => {
    // "me" is Managerial Economics' alias; it must not match unrelated
    // subjects that merely contain those letters.
    expect(matchSubjectToTextbook("Home Economics")).toBeNull();
  });

  it("returns null for an empty or unmapped subject", () => {
    expect(matchSubjectToTextbook("")).toBeNull();
    expect(matchSubjectToTextbook("Astrophysics")).toBeNull();
  });
});

describe("matchConceptToTextbookTopic", () => {
  it("matches via substring for a multi-word concept phrase", () => {
    const book = matchSubjectToTextbook("FM")!;
    const topic = matchConceptToTextbookTopic("the concept of working capital management", book);
    expect(topic?.name).toBe("Working Capital Management");
  });

  it("returns null when nothing matches", () => {
    const book = matchSubjectToTextbook("FM")!;
    expect(matchConceptToTextbookTopic("astrology", book)).toBeNull();
  });
});
