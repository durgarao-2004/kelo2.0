import "server-only";
import { routeTask } from "@/features/ai/router";
import {
  extractJsonObject,
  asStringArray,
  asFlashcards,
  asDefinitions,
  asNoteSections,
} from "@/features/ai/parse";
import { clipForAnalysis } from "@/features/ai/limits";
import {
  emptyLectureAnalysis,
  type LectureAnalysis,
} from "@/features/ai/lecture-analysis";
import type { AiTask, GenerateRequest } from "@/features/ai/types";
import { buildAiClients } from "./clients";

export type { LectureAnalysis };

export async function runAiTask(task: AiTask, req: GenerateRequest) {
  return routeTask(task, req, buildAiClients());
}

const LECTURE_SYSTEM = `You are an academic study assistant. Given a lecture transcript, produce exam-focused study material.

GROUNDING RULES — these override everything else:
- Use ONLY information explicitly present in the transcript below. Do not invent, assume, or supplement with outside knowledge.
- Never invent textbook definitions, citations, facts, or professor statements that are not actually in the transcript.
- If the lecturer did not give a definition for a concept, do NOT make one up — just omit it from "definitions".
- If the lecturer gave no worked examples, return an empty "examples" array rather than inventing one.
- It is correct and expected to return short or empty arrays when the transcript doesn't contain that kind of content. A sparse but accurate result is always better than a fabricated one.

Respond with STRICT JSON only, matching exactly:
{
  "title": string,                // concise, specific lecture title
  "summary": string,              // 3-6 sentence summary
  "key_concepts": string[],       // core concepts/terms actually discussed
  "important_points": string[],   // the most important exam-relevant takeaways
  "topics": string[],             // short topic tags
  "notes": [{"heading": string, "points": string[]}],  // structured lecture notes, grouped by subtopic in the order they were covered
  "definitions": [{"term": string, "definition": string}], // ONLY terms the lecturer actually defined
  "examples": string[],           // examples/worked problems/analogies the lecturer actually mentioned
  "revision": {
    "exam_questions": string[],   // likely exam questions based on emphasis in the transcript
    "flashcards": [{"q": string, "a": string}],
    "quick_review": string[]      // one-line facts to review
  }
}
Do not include commentary outside the JSON.`;

/**
 * One efficient pass that titles, summarizes, extracts concepts, and builds
 * revision material. Uses the fast/quality tier via the router with fallback.
 * Grounded strictly in the transcript — never fabricates content when the
 * transcript doesn't contain it (see LECTURE_SYSTEM's grounding rules).
 */
export async function analyzeLecture(
  transcript: string,
  subjectName: string,
): Promise<LectureAnalysis> {
  if (!transcript.trim()) return emptyLectureAnalysis(subjectName);

  const result = await runAiTask("summary", {
    json: true,
    temperature: 0.3,
    maxTokens: 4096,
    messages: [
      { role: "system", content: LECTURE_SYSTEM },
      {
        role: "user",
        content: `Subject: ${subjectName}\n\nTranscript:\n${clipForAnalysis(transcript)}`,
      },
    ],
  });

  const parsed = (extractJsonObject(result.text) ?? {}) as Record<string, unknown>;
  const revision = (parsed.revision ?? {}) as Record<string, unknown>;

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : `${subjectName} lecture`,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    keyConcepts: asStringArray(parsed.key_concepts),
    importantPoints: asStringArray(parsed.important_points),
    topics: asStringArray(parsed.topics),
    notes: asNoteSections(parsed.notes),
    definitions: asDefinitions(parsed.definitions),
    examples: asStringArray(parsed.examples),
    revision: {
      examQuestions: asStringArray(revision.exam_questions),
      flashcards: asFlashcards(revision.flashcards),
      quickReview: asStringArray(revision.quick_review),
    },
    provider: result.provider,
    model: result.model,
  };
}

export interface AnswerContext {
  source: string; // e.g. "Lecture: Neural Nets (2026-03-01)"
  content: string;
}

const QA_SYSTEM = `You are KELO, a study assistant that answers questions using ONLY the provided lecture excerpts.
Rules:
- Answer concisely and accurately from the context.
- If the context doesn't contain the answer, say you couldn't find it in their lectures.
- Cite the sources you used by their [n] number.`;

/**
 * Answer a question grounded in retrieved lecture context (RAG). Uses the
 * best-reasoning tier with fallback. Returns the answer text plus provenance.
 */
export async function answerWithContext(
  question: string,
  contexts: AnswerContext[],
): Promise<{ answer: string; provider: string; model: string }> {
  const contextBlock = contexts
    .map((c, i) => `[${i + 1}] (${c.source})\n${c.content}`)
    .join("\n\n");

  const result = await runAiTask("qa", {
    temperature: 0.2,
    maxTokens: 900,
    messages: [
      { role: "system", content: QA_SYSTEM },
      {
        role: "user",
        content: `Question: ${question}\n\nLecture excerpts:\n${contextBlock || "(no relevant excerpts found)"}`,
      },
    ],
  });

  return { answer: result.text.trim(), provider: result.provider, model: result.model };
}
