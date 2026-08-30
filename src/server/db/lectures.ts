import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, LectureStatus } from "@/lib/supabase/types";
import { ATTENTION_STATUSES, attentionRank } from "@/features/dashboard/lecture-attention";
import type { DbResult } from "./subjects";

export type Lecture = Database["public"]["Tables"]["lectures"]["Row"];

export interface LectureWithSubject extends Lecture {
  subject: { id: string; name: string; color: string } | null;
}

export async function listLectures(
  userId: string,
  limit = 50,
): Promise<DbResult<LectureWithSubject[]>> {
  const { data, error } = await getSupabaseAdmin()
    .from("lectures")
    .select("*, subject:subjects(id, name, color)")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  return {
    data: (data as LectureWithSubject[] | null) ?? [],
    error: error?.message ?? null,
  };
}

/**
 * Lectures a student should actually look at right now: ones stuck needing a
 * retry, or ones still processing. Ordered so failed/recoverable (actionable)
 * come first, then in-flight (informational), most recently touched first.
 * Excludes "completed" and "recording"/"uploaded" (normal, no action needed).
 *
 * Two queries rather than one embedded select — combining `.in()` with an
 * embedded `subject:subjects(...)` relation defeats this Supabase client
 * version's type inference for the row shape (see textbook-concepts.ts for
 * the same workaround).
 */
export async function listLecturesNeedingAttention(
  userId: string,
  limit = 5,
): Promise<DbResult<LectureWithSubject[]>> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("lectures")
    .select("*")
    .eq("user_id", userId)
    .in("status", ATTENTION_STATUSES as LectureStatus[])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };

  const rows = data ?? [];
  if (rows.length === 0) return { data: [], error: null };

  const subjectIds = [...new Set(rows.map((r) => r.subject_id).filter((id): id is string => Boolean(id)))];
  const { data: subjects } = subjectIds.length
    ? await db.from("subjects").select("id, name, color").eq("user_id", userId).in("id", subjectIds)
    : { data: [] };
  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s]));

  const withSubject: LectureWithSubject[] = rows
    .map((r) => ({ ...r, subject: r.subject_id ? (subjectById.get(r.subject_id) ?? null) : null }))
    .sort((a, b) => attentionRank(a.status) - attentionRank(b.status));
  return { data: withSubject, error: null };
}

export async function getLecture(
  userId: string,
  id: string,
): Promise<DbResult<LectureWithSubject | null>> {
  const { data, error } = await getSupabaseAdmin()
    .from("lectures")
    .select("*, subject:subjects(id, name, color)")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return {
    data: (data as LectureWithSubject | null) ?? null,
    error: error?.message ?? null,
  };
}

export type SummaryRow = Database["public"]["Tables"]["summaries"]["Row"];
export type LectureConceptRow = Database["public"]["Tables"]["lecture_concepts"]["Row"];

export interface LectureDetail {
  lecture: LectureWithSubject;
  transcript: string | null;
  summary: SummaryRow | null;
  /** Textbook-grounded concepts, if any were matched — kept separate from
   * `summary` so lecture content and academic-reference content are never
   * conflated in the UI. */
  concepts: LectureConceptRow[];
}

export async function getLectureDetail(
  userId: string,
  id: string,
): Promise<DbResult<LectureDetail | null>> {
  const db = getSupabaseAdmin();
  const { data: lecture, error } = await db
    .from("lectures")
    .select("*, subject:subjects(id, name, color)")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!lecture) return { data: null, error: null };

  const [{ data: transcript }, { data: summary }, { data: concepts }] = await Promise.all([
    db.from("transcripts").select("content").eq("lecture_id", id).maybeSingle(),
    db.from("summaries").select("*").eq("lecture_id", id).maybeSingle(),
    db
      .from("lecture_concepts")
      .select("*")
      .eq("user_id", userId)
      .eq("lecture_id", id)
      .order("created_at", { ascending: true }),
  ]);

  return {
    data: {
      lecture: lecture as unknown as LectureWithSubject,
      transcript: transcript?.content ?? null,
      summary: (summary as SummaryRow | null) ?? null,
      concepts: (concepts as LectureConceptRow[] | null) ?? [],
    },
    error: null,
  };
}
