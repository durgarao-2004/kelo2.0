import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
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

export interface LectureDetail {
  lecture: LectureWithSubject;
  transcript: string | null;
  summary: SummaryRow | null;
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

  const [{ data: transcript }, { data: summary }] = await Promise.all([
    db.from("transcripts").select("content").eq("lecture_id", id).maybeSingle(),
    db.from("summaries").select("*").eq("lecture_id", id).maybeSingle(),
  ]);

  return {
    data: {
      lecture: lecture as unknown as LectureWithSubject,
      transcript: transcript?.content ?? null,
      summary: (summary as SummaryRow | null) ?? null,
    },
    error: null,
  };
}
