import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getTextbookByKey, formatTextbookCitation } from "@/config/textbooks";

export interface AcademicReferenceHit {
  lectureId: string;
  lectureTitle: string;
  concept: string;
  citation: string;
}

/** Search only concepts that were actually confirmed against a configured
 * textbook (`textbook_status = 'verified'`) — never surfaces an
 * unverified/pending match as if it were a real academic reference. */
export async function searchAcademicReferences(
  userId: string,
  query: string,
  limit = 8,
): Promise<{ data: AcademicReferenceHit[]; error: string | null }> {
  const trimmed = query.trim();
  if (!trimmed) return { data: [], error: null };

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("lecture_concepts")
    .select("lecture_id, concept, textbook_subject_key")
    .eq("user_id", userId)
    .eq("textbook_status", "verified")
    .ilike("concept", `%${trimmed}%`)
    .limit(limit);
  if (error) return { data: [], error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) return { data: [], error: null };

  const lectureIds = [...new Set(rows.map((r) => r.lecture_id))];
  const { data: lectures } = await db
    .from("lectures")
    .select("id, title")
    .eq("user_id", userId)
    .in("id", lectureIds);
  const titles = new Map((lectures ?? []).map((l) => [l.id, l.title ?? "Untitled lecture"]));

  const hits: AcademicReferenceHit[] = [];
  for (const row of rows) {
    const book = row.textbook_subject_key ? getTextbookByKey(row.textbook_subject_key) : null;
    if (!book) continue;
    hits.push({
      lectureId: row.lecture_id,
      lectureTitle: titles.get(row.lecture_id) ?? "Untitled lecture",
      concept: row.concept,
      citation: formatTextbookCitation(book),
    });
  }
  return { data: hits, error: null };
}
