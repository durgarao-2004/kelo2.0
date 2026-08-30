/**
 * Central textbook configuration (Phase 4 — textbook-grounded knowledge).
 *
 * This is bibliographic reference data ONLY: title, authors, edition,
 * publisher, and a short list of well-known standard topic names each book
 * covers (generic subject-matter terminology, not copied text — the kind of
 * thing that appears in any public syllabus or table of contents). KELO does
 * NOT have licensed digital text for any of these books, does not scrape or
 * store book content, and never fabricates page numbers, quotations, or
 * chapter references.
 *
 * Adding a textbook later means appending one entry here — nothing else in
 * the system needs to change (see features/knowledge/textbook-match.ts and
 * server/knowledge/ground-concepts.ts, which are entirely driven by this list).
 */

export type TextbookSourceType =
  /** We only have publisher-level bibliographic facts — no licensed text. */
  | "print_textbook_metadata_only"
  | "licensed_etext"
  | "user_provided"
  | "pending";

export type TextbookVerificationStatus = "verified_metadata" | "pending";

export interface TextbookTopic {
  /** Canonical display name of a standard topic this book covers. */
  name: string;
  /** Alternate names/abbreviations a lecture or student might use for it. */
  aliases?: string[];
}

export interface TextbookConfig {
  /** Stable, code-level identifier — never reused, never renamed. */
  subjectKey: string;
  subjectLabel: string;
  title: string | null;
  authors: string[];
  edition: string | null;
  publisher: string | null;
  isbn?: string;
  sourceUrls?: string[];
  sourceType: TextbookSourceType;
  verificationStatus: TextbookVerificationStatus;
  /** Well-known standard topics this book covers, for concept matching.
   * Empty when verificationStatus is "pending" — nothing to match against. */
  topics: TextbookTopic[];
  /** Free-text subject names a user might type that should resolve to this
   * textbook (matched case/whitespace-insensitively — see textbook-match.ts). */
  subjectAliases: string[];
}

export const TEXTBOOKS: TextbookConfig[] = [
  {
    subjectKey: "financial_management",
    subjectLabel: "Financial Management",
    title: "Financial Management",
    authors: ["I. M. Pandey"],
    edition: "13th Edition",
    publisher: "Pearson",
    sourceType: "print_textbook_metadata_only",
    verificationStatus: "verified_metadata",
    subjectAliases: ["fm", "financial management"],
    topics: [
      { name: "Capital Budgeting", aliases: ["capital budgeting decisions"] },
      { name: "Net Present Value", aliases: ["npv"] },
      { name: "Internal Rate of Return", aliases: ["irr"] },
      { name: "Cost of Capital", aliases: ["weighted average cost of capital", "wacc"] },
      { name: "Capital Structure", aliases: ["capital structure theory"] },
      { name: "Working Capital Management", aliases: ["working capital"] },
      { name: "Dividend Policy", aliases: ["dividend decisions"] },
      { name: "Time Value of Money", aliases: ["tvm", "present value", "future value"] },
      { name: "Ratio Analysis", aliases: ["financial ratios"] },
      { name: "Leverage", aliases: ["operating leverage", "financial leverage"] },
      { name: "Risk and Return", aliases: [] },
    ],
  },
  {
    subjectKey: "mis",
    subjectLabel: "Management Information Systems",
    title: "Management Information Systems: Managing the Digital Firm",
    authors: ["Kenneth C. Laudon", "Jane P. Laudon"],
    edition: "17th Edition",
    publisher: "Pearson",
    sourceType: "print_textbook_metadata_only",
    verificationStatus: "verified_metadata",
    subjectAliases: ["mis", "management information systems"],
    topics: [
      { name: "Information Systems", aliases: ["information systems in business"] },
      { name: "Digital Firm", aliases: ["managing the digital firm"] },
      { name: "Enterprise Systems", aliases: ["erp", "enterprise resource planning"] },
      { name: "Supply Chain Management Systems", aliases: ["scm"] },
      { name: "Customer Relationship Management", aliases: ["crm"] },
      { name: "Business Intelligence", aliases: ["bi", "decision support"] },
      { name: "E-commerce", aliases: ["electronic commerce"] },
      { name: "Knowledge Management", aliases: [] },
      { name: "IT Infrastructure", aliases: ["information technology infrastructure"] },
      { name: "Systems Development Life Cycle", aliases: ["sdlc"] },
      { name: "Information Security", aliases: ["cybersecurity"] },
    ],
  },
  {
    subjectKey: "organizational_behavior",
    subjectLabel: "Organizational Behavior",
    title: "Organizational Behavior",
    authors: ["Stephen P. Robbins", "Timothy A. Judge", "Neharika Vohra"],
    edition: "18th Edition",
    publisher: "Pearson",
    sourceType: "print_textbook_metadata_only",
    verificationStatus: "verified_metadata",
    subjectAliases: ["ob", "organizational behavior", "organisational behaviour"],
    topics: [
      { name: "Motivation", aliases: ["motivation theories"] },
      { name: "Personality and Values", aliases: ["personality traits"] },
      { name: "Perception", aliases: ["perception and individual decision making"] },
      { name: "Group Behavior", aliases: ["group dynamics"] },
      { name: "Leadership", aliases: ["leadership styles", "leadership theories"] },
      { name: "Organizational Culture", aliases: [] },
      { name: "Organizational Change", aliases: ["change management"] },
      { name: "Communication", aliases: [] },
      { name: "Power and Politics", aliases: ["organizational politics"] },
      { name: "Job Satisfaction", aliases: [] },
      { name: "Emotions and Moods", aliases: [] },
      { name: "Teams", aliases: ["work teams", "team dynamics"] },
    ],
  },
  {
    subjectKey: "marketing_management",
    subjectLabel: "Marketing Management",
    title: "Marketing Management",
    authors: [
      "Philip Kotler",
      "Kevin Lane Keller",
      "Alexander Chernev",
      "Jagdish N. Sheth",
      "G. Shainesh",
    ],
    edition: "17th Edition",
    publisher: "Pearson",
    sourceType: "print_textbook_metadata_only",
    verificationStatus: "verified_metadata",
    subjectAliases: ["mm", "marketing management", "marketing"],
    topics: [
      { name: "Marketing Mix", aliases: ["4 ps of marketing"] },
      {
        name: "Segmentation, Targeting, and Positioning",
        aliases: ["stp", "market segmentation"],
      },
      { name: "Consumer Behavior", aliases: ["buyer behavior"] },
      { name: "Brand Equity", aliases: ["branding"] },
      { name: "Product Life Cycle", aliases: ["plc"] },
      { name: "Pricing Strategy", aliases: ["pricing decisions"] },
      { name: "Marketing Channels", aliases: ["distribution channels"] },
      { name: "Integrated Marketing Communications", aliases: ["imc", "promotion"] },
      { name: "Digital Marketing", aliases: [] },
      { name: "Market Research", aliases: ["marketing research"] },
      { name: "Customer Value", aliases: ["customer lifetime value"] },
    ],
  },
  {
    subjectKey: "accounting",
    subjectLabel: "Financial and Managerial Accounting",
    title: "Financial and Managerial Accounting",
    authors: ["Carl S. Warren", "Jefferson P. Jones", "William B. Tayler"],
    edition: "15th Edition",
    publisher: "Cengage",
    sourceType: "print_textbook_metadata_only",
    verificationStatus: "verified_metadata",
    subjectAliases: [
      "afm",
      "accounting",
      "accounts for managers",
      "financial accounting",
      "managerial accounting",
    ],
    topics: [
      { name: "Financial Statements", aliases: [] },
      { name: "Balance Sheet", aliases: ["statement of financial position"] },
      { name: "Income Statement", aliases: ["profit and loss statement"] },
      { name: "Cash Flow Statement", aliases: ["statement of cash flows"] },
      { name: "Cost-Volume-Profit Analysis", aliases: ["cvp analysis", "break-even analysis"] },
      { name: "Budgeting", aliases: ["budgetary control"] },
      { name: "Job Order Costing", aliases: [] },
      { name: "Process Costing", aliases: [] },
      { name: "Ratio Analysis", aliases: ["accounting ratios"] },
      { name: "Depreciation", aliases: [] },
      { name: "Accounting Equation", aliases: [] },
    ],
  },
  {
    subjectKey: "managerial_economics",
    subjectLabel: "Managerial Economics",
    title: "Managerial Economics: Applications, Strategy and Tactics",
    authors: ["James R. McGuigan", "R. Charles Moyer", "Frederick H. deB. Harris"],
    edition: null,
    publisher: null,
    sourceType: "print_textbook_metadata_only",
    verificationStatus: "verified_metadata",
    subjectAliases: ["me", "managerial economics"],
    topics: [
      { name: "Demand Analysis and Estimation", aliases: ["demand estimation"] },
      { name: "Production and Cost Analysis", aliases: ["production function"] },
      { name: "Market Structure", aliases: ["monopoly", "oligopoly", "perfect competition"] },
      { name: "Pricing Practices", aliases: ["pricing strategy"] },
      { name: "Game Theory", aliases: ["strategic behavior"] },
      { name: "Risk Analysis", aliases: ["decision making under uncertainty"] },
      { name: "Elasticity of Demand", aliases: ["price elasticity"] },
      { name: "Break-even Analysis", aliases: [] },
      { name: "Opportunity Cost", aliases: [] },
    ],
  },
  {
    // Edition/publisher were not confirmed from a supplied book photo — per
    // instructions, missing bibliographic facts are never guessed. This
    // entry exists so the subject can be identified as "pending" rather
    // than silently falling through to "no textbook configured," but no
    // concept will ever be matched against it until verified.
    subjectKey: "data_science_for_managers",
    subjectLabel: "Data Science for Managers",
    title: null,
    authors: [],
    edition: null,
    publisher: null,
    sourceType: "pending",
    verificationStatus: "pending",
    subjectAliases: ["data science", "data science for managers"],
    topics: [],
  },
];

export function allTextbooks(): TextbookConfig[] {
  return TEXTBOOKS;
}

export function getTextbookByKey(subjectKey: string): TextbookConfig | null {
  return TEXTBOOKS.find((t) => t.subjectKey === subjectKey) ?? null;
}

/** Clean, student-facing citation line — e.g. "Financial Management — I.M.
 * Pandey, 13th Edition". Never shown with internal status/confidence fields. */
export function formatTextbookCitation(book: TextbookConfig): string {
  const authors = book.authors.join(" & ");
  const parts = [book.title, authors].filter(Boolean);
  const line = parts.join(" — ");
  return book.edition ? `${line}, ${book.edition}` : line;
}
