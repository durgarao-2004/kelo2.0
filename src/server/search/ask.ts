import "server-only";
import { retrieveChunks, type RetrievedChunk } from "./retrieve";
import { searchAcademicReferences, type AcademicReferenceHit } from "./textbook-concepts";
import { combineAskContext } from "@/features/search/combine-ask-result";
import { answerWithContext } from "@/server/ai/tasks";
import { toUserFacingAiError } from "@/lib/errors/user-facing";

export interface AskSource {
  lectureId: string;
  title: string;
  subjectName: string | null;
  recordedAt: string | null;
}

export interface AskResult {
  answer: string;
  sources: AskSource[];
  /** Verified textbook references matching the question, kept separate from
   * the lecture-grounded answer above — never blended into it. Empty when
   * nothing matches; a lookup failure here never fails the overall answer. */
  academicReferences: AcademicReferenceHit[];
  provider: string | null;
  error: string | null;
}

function uniqueSources(chunks: RetrievedChunk[]): AskSource[] {
  const seen = new Map<string, AskSource>();
  for (const c of chunks) {
    if (!seen.has(c.lectureId)) {
      seen.set(c.lectureId, {
        lectureId: c.lectureId,
        title: c.lectureTitle,
        subjectName: c.subjectName,
        recordedAt: c.recordedAt,
      });
    }
  }
  return [...seen.values()];
}

/**
 * "Ask my lectures": retrieve relevant chunks, ground the model on them, and
 * return the answer with the source lectures it drew from.
 */
export async function askLectures(
  userId: string,
  question: string,
): Promise<AskResult> {
  const [chunksOutcome, academicOutcome] = await Promise.all([
    retrieveChunks(userId, question, 6),
    searchAcademicReferences(userId, question, 4),
  ]);
  const { chunks, academicReferences, chunksError } = combineAskContext(
    chunksOutcome,
    academicOutcome,
  );
  if (chunksError) {
    return { answer: "", sources: [], academicReferences: [], provider: null, error: chunksError };
  }
  if (chunks.length === 0) {
    return {
      answer:
        "I couldn’t find anything relevant in your lectures yet. Record and process some lectures first.",
      sources: [],
      academicReferences,
      provider: null,
      error: null,
    };
  }

  try {
    const { answer, provider } = await answerWithContext(
      question,
      chunks.map((c) => ({
        source: `${c.lectureTitle}${c.subjectName ? ` · ${c.subjectName}` : ""}`,
        content: c.content,
      })),
    );
    return { answer, sources: uniqueSources(chunks), academicReferences, provider, error: null };
  } catch (e) {
    console.error("askLectures failed:", e instanceof Error ? e.message : e);
    return {
      answer: "",
      sources: uniqueSources(chunks),
      academicReferences,
      provider: null,
      error: toUserFacingAiError(e instanceof Error ? e.message : null),
    };
  }
}
