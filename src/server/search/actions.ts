"use server";

import { requireUser } from "@/server/auth/current-user";
import { askLectures, type AskSource } from "./ask";
import { retrieveChunks } from "./retrieve";
import { searchAcademicReferences, type AcademicReferenceHit } from "./textbook-concepts";

export interface AskState {
  asked?: boolean;
  answer?: string;
  sources?: AskSource[];
  academicReferences?: AcademicReferenceHit[];
  error?: string;
}

export async function askAction(
  _prev: AskState,
  formData: FormData,
): Promise<AskState> {
  const user = await requireUser();
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { error: "Enter a question." };

  const result = await askLectures(user.id, question);
  return {
    asked: true,
    answer: result.answer,
    sources: result.sources,
    academicReferences: result.academicReferences,
    error: result.error ?? undefined,
  };
}

export interface SearchHit {
  lectureId: string;
  title: string;
  subjectName: string | null;
  source: string;
  excerpt: string;
}

export interface SearchState {
  searched?: boolean;
  hits?: SearchHit[];
  /** Kept separate from `hits` — these are textbook-grounded academic
   * references, not lecture content, and must never be blended together. */
  academicHits?: AcademicReferenceHit[];
  error?: string;
}

export async function searchAction(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const user = await requireUser();
  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { error: "Enter something to search for." };

  const [{ data, error }, { data: academicHits }] = await Promise.all([
    retrieveChunks(user.id, query, 12),
    searchAcademicReferences(user.id, query, 8),
  ]);
  if (error) return { searched: true, error };

  return {
    searched: true,
    hits: data.map((c) => ({
      lectureId: c.lectureId,
      title: c.lectureTitle,
      subjectName: c.subjectName,
      source: c.source,
      excerpt: c.content.length > 240 ? `${c.content.slice(0, 240)}…` : c.content,
    })),
    academicHits,
  };
}
