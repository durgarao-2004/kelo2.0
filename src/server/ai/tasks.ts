import "server-only";
import { routeTask } from "@/features/ai/router";
import {
  extractJsonObject,
  asStringArray,
  asFlashcards,
  type Flashcard,
} from "@/features/ai/parse";
import type { AiTask, GenerateRequest } from "@/features/ai/types";
import { buildAiClients } from "./clients";

const MAX_TRANSCRIPT_CHARS = 14_000;

function clip(text: string): string {
  return text.length > MAX_TRANSCRIPT_CHARS
    ? `${text.slice(0, MAX_TRANSCRIPT_CHARS)}…`
    : text;
}

export async function runAiTask(task: AiTask, req: GenerateRequest) {
  return routeTask(task, req, buildAiClients());
}

export interface LectureAnalysis {
  title: string;
  summary: string;
  keyConcepts: string[];
  importantPoints: string[];
  topics: string[];
  revision: {
    examQuestions: string[];
    flashcards: Flashcard[];
    quickReview: string[];
  };
  provider: string;
  model: string;
}

const LECTURE_SYSTEM = `You are an academic study assistant. Given a lecture transcript, produce exam-focused study material.
Respond with STRICT JSON only, matching exactly:
{
  "title": string,                // concise, specific lecture title
  "summary": string,              // 3-6 sentence summary
  "key_concepts": string[],       // core concepts/terms
  "important_points": string[],   // the most important takeaways
  "topics": string[],             // short topic tags
  "revision": {
    "exam_questions": string[],   // likely exam questions
    "flashcards": [{"q": string, "a": string}],
    "quick_review": string[]      // one-line facts to review
  }
}
Do not include commentary outside the JSON.`;

/**
 * One efficient pass that titles, summarizes, extracts concepts, and builds
 * revision material. Uses the fast/quality tier via the router with fallback.
 */
export async function analyzeLecture(
  transcript: string,
  subjectName: string,
): Promise<LectureAnalysis> {
  const result = await runAiTask("summary", {
    json: true,
    temperature: 0.3,
    maxTokens: 1600,
    messages: [
      { role: "system", content: LECTURE_SYSTEM },
      {
        role: "user",
        content: `Subject: ${subjectName}\n\nTranscript:\n${clip(transcript)}`,
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
