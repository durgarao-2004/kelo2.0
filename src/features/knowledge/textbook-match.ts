import { TEXTBOOKS, type TextbookConfig, type TextbookTopic } from "@/config/textbooks";

/**
 * Deterministic, non-AI matching: does a subject have a verified textbook,
 * and does a given concept correspond to one of that textbook's well-known
 * standard topics? This is the layer that decides WHETHER an explanation is
 * allowed to be textbook-grounded — the AI is never asked to decide this
 * itself, so it can't hallucinate a match that doesn't exist.
 */
export type TextbookMatchStatus = "verified" | "unverified" | "pending" | "not_configured";

export interface ConceptTextbookMatch {
  status: TextbookMatchStatus;
  textbook: TextbookConfig | null;
  topic: TextbookTopic | null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Resolve a user's free-text subject name (e.g. "FM", "AFM", "Marketing
 * Management") to a configured textbook, or null if none is configured. */
export function matchSubjectToTextbook(
  subjectName: string,
  textbooks: TextbookConfig[] = TEXTBOOKS,
): TextbookConfig | null {
  const norm = normalize(subjectName);
  if (!norm) return null;

  for (const book of textbooks) {
    if (book.subjectAliases.some((alias) => normalize(alias) === norm)) return book;
  }
  // Fuzzy fallback restricted to multi-word aliases only — a short
  // abbreviation like "me" or "ob" must match exactly, never as a substring,
  // to avoid false positives against unrelated subject names.
  for (const book of textbooks) {
    for (const alias of book.subjectAliases) {
      const na = normalize(alias);
      if (na.includes(" ") && (norm.includes(na) || na.includes(norm))) return book;
    }
  }
  return null;
}

/** Does `concept` correspond to one of this textbook's known standard topics? */
export function matchConceptToTextbookTopic(
  concept: string,
  book: TextbookConfig,
): TextbookTopic | null {
  const norm = normalize(concept);
  if (!norm) return null;

  for (const topic of book.topics) {
    const names = [topic.name, ...(topic.aliases ?? [])].map(normalize);
    if (names.includes(norm)) return topic;
  }
  for (const topic of book.topics) {
    const names = [topic.name, ...(topic.aliases ?? [])].map(normalize);
    if (names.some((n) => n.length > 2 && (norm.includes(n) || n.includes(norm)))) return topic;
  }
  return null;
}

/**
 * Full decision for one (subject, concept) pair:
 *   not_configured — no textbook mapped to this subject at all
 *   pending        — a textbook is mapped but its metadata isn't verified yet
 *   unverified     — the textbook is verified but this concept doesn't match
 *                     any of its known topics (never fabricate a citation here)
 *   verified       — the concept matches a known topic in a verified textbook
 */
export function matchConceptToTextbook(
  subjectName: string,
  concept: string,
  textbooks: TextbookConfig[] = TEXTBOOKS,
): ConceptTextbookMatch {
  const book = matchSubjectToTextbook(subjectName, textbooks);
  if (!book) return { status: "not_configured", textbook: null, topic: null };
  if (book.verificationStatus === "pending" || book.sourceType === "pending") {
    return { status: "pending", textbook: book, topic: null };
  }
  const topic = matchConceptToTextbookTopic(concept, book);
  if (!topic) return { status: "unverified", textbook: book, topic: null };
  return { status: "verified", textbook: book, topic };
}

/**
 * The system has no page-level or chapter-level access to any of these
 * books, so any such reference in AI-generated text is definitionally
 * fabricated — strip it unconditionally rather than trust the prompt alone.
 */
const FABRICATED_SOURCE_DETAIL = /\b(pp?\.?\s?\d+(-\d+)?|pages?\s+\d+(-\d+)?|chapter\s+\d+)\b/gi;

export function stripFabricatedSourceDetails(text: string): string {
  return text.replace(FABRICATED_SOURCE_DETAIL, "").replace(/\s{2,}/g, " ").trim();
}
