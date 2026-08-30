import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runAiTask } from "@/server/ai/tasks";
import { extractJsonObject } from "@/features/ai/parse";
import { clipForAnalysis } from "@/features/ai/limits";
import {
  matchConceptToTextbook,
  stripFabricatedSourceDetails,
  type ConceptTextbookMatch,
} from "@/features/knowledge/textbook-match";

// Bounds AI cost and keeps the pipeline fast — a lecture rarely has more
// than a handful of concepts genuinely worth textbook-grounding anyway.
const MAX_CONCEPTS_TO_GROUND = 6;
const TRANSCRIPT_EXCERPT_CHARS = 8000;

const GROUNDING_SYSTEM = `You produce textbook-grounded explanations for academic concepts that a separate verification step has already confirmed are standard topics in a specific, named textbook.

For each concept you are given (with its textbook title, authors, and matched topic name):
- Write a concise (2-3 sentence) EXPLANATION of the concept as it would typically appear in a standard academic textbook on this subject. This must be a general, standard academic explanation grounded in your knowledge of this well-established topic — NOT a direct quotation, NOT a claim about the book's exact wording, and NEVER a page or chapter number (you do not have access to this book's actual text, only its title/authors/topic list).
- Using ONLY the lecture transcript excerpt provided, write a short (1 sentence) LECTURE CONNECTION describing what the lecture specifically said about this concept. If the transcript doesn't clearly address it, say exactly: "The lecture mentioned this concept without elaborating on it in the transcript."
- Keep the two strictly separate — never blend the lecture's specific wording into the textbook explanation, or vice versa.

Respond with STRICT JSON only, matching exactly:
{ "concepts": [ { "concept": string, "explanation": string, "lectureConnection": string } ] }
Do not include commentary outside the JSON.`;

export interface GroundedConcept {
  concept: string;
  status: ConceptTextbookMatch["status"];
  textbookSubjectKey: string | null;
  lectureConnection: string | null;
  textbookExplanation: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function generateExplanations(
  subjectName: string,
  transcript: string,
  verified: Array<{ concept: string; match: ConceptTextbookMatch }>,
): Promise<Map<string, { explanation: string; lectureConnection: string }>> {
  const result = new Map<string, { explanation: string; lectureConnection: string }>();
  if (verified.length === 0) return result;

  try {
    const response = await runAiTask("concepts", {
      json: true,
      temperature: 0.3,
      maxTokens: 1600,
      messages: [
        { role: "system", content: GROUNDING_SYSTEM },
        {
          role: "user",
          content: [
            `Subject: ${subjectName}`,
            "Concepts to explain:",
            JSON.stringify(
              verified.map(({ concept, match }) => ({
                concept,
                textbookTitle: match.textbook?.title,
                authors: match.textbook?.authors,
                topic: match.topic?.name,
              })),
            ),
            "Lecture transcript excerpt:",
            clipForAnalysis(transcript, TRANSCRIPT_EXCERPT_CHARS),
          ].join("\n\n"),
        },
      ],
    });

    const parsed = asRecord(extractJsonObject(response.text));
    const list = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
    for (const item of list) {
      const row = asRecord(item);
      const concept = row?.concept;
      const explanation = row?.explanation;
      if (typeof concept === "string" && typeof explanation === "string") {
        const lectureConnection =
          typeof row?.lectureConnection === "string" ? row.lectureConnection : "";
        result.set(concept.trim().toLowerCase(), {
          explanation: stripFabricatedSourceDetails(explanation.trim()),
          lectureConnection: stripFabricatedSourceDetails(lectureConnection.trim()),
        });
      }
    }
  } catch {
    // Best-effort enrichment only — a failure here must never fail the
    // overall lecture-processing pipeline, which has already succeeded by
    // the time this runs.
  }
  return result;
}

/**
 * For each extracted lecture concept, deterministically decide whether it
 * matches a configured, verified textbook topic, then (only for verified
 * matches) generate a grounded explanation + lecture connection. Never
 * fabricates a textbook citation for an unmatched concept — those are
 * stored with an honest status and no explanation text.
 */
export async function groundLectureConcepts(params: {
  lectureId: string;
  userId: string;
  subjectId: string | null;
  subjectName: string;
  transcript: string;
  concepts: string[];
}): Promise<void> {
  const concepts = [...new Set(params.concepts.map((c) => c.trim()).filter(Boolean))].slice(
    0,
    MAX_CONCEPTS_TO_GROUND,
  );
  if (concepts.length === 0) return;

  const matches = concepts.map((concept) => ({
    concept,
    match: matchConceptToTextbook(params.subjectName, concept),
  }));
  const verified = matches.filter((m) => m.match.status === "verified");
  const explanations = await generateExplanations(params.subjectName, params.transcript, verified);

  const rows: GroundedConcept[] = matches.map(({ concept, match }) => {
    const generated = explanations.get(concept.toLowerCase());
    return {
      concept,
      status: match.status,
      textbookSubjectKey: match.textbook?.subjectKey ?? null,
      textbookExplanation: match.status === "verified" ? (generated?.explanation ?? null) : null,
      lectureConnection: match.status === "verified" ? (generated?.lectureConnection ?? null) : null,
    };
  });

  const db = getSupabaseAdmin();
  await db.from("lecture_concepts").upsert(
    rows.map((r) => ({
      lecture_id: params.lectureId,
      user_id: params.userId,
      subject_id: params.subjectId,
      concept: r.concept,
      lecture_connection: r.lectureConnection,
      textbook_subject_key: r.textbookSubjectKey,
      textbook_status: r.status,
      textbook_explanation: r.textbookExplanation,
    })),
    { onConflict: "lecture_id,concept" },
  );
}
