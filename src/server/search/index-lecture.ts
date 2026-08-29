import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { chunkText } from "@/features/search/chunk";
import type { Database } from "@/lib/supabase/types";

type ChunkInsert = Database["public"]["Tables"]["lecture_chunks"]["Insert"];

/**
 * (Re)build the searchable chunks for a lecture from its transcript and
 * summary. Replaces any existing chunks so re-processing is idempotent.
 */
export async function indexLectureChunks(params: {
  userId: string;
  lectureId: string;
  subjectId: string | null;
  transcript?: string | null;
  summary?: string | null;
}): Promise<{ inserted: number; error: string | null }> {
  const db = getSupabaseAdmin();

  await db
    .from("lecture_chunks")
    .delete()
    .eq("user_id", params.userId)
    .eq("lecture_id", params.lectureId);

  const rows: ChunkInsert[] = [];
  let idx = 0;
  for (const c of chunkText(params.transcript ?? "")) {
    rows.push({
      user_id: params.userId,
      lecture_id: params.lectureId,
      subject_id: params.subjectId,
      source: "transcript",
      chunk_index: idx++,
      content: c.content,
    });
  }
  for (const c of chunkText(params.summary ?? "")) {
    rows.push({
      user_id: params.userId,
      lecture_id: params.lectureId,
      subject_id: params.subjectId,
      source: "summary",
      chunk_index: idx++,
      content: c.content,
    });
  }

  if (rows.length === 0) return { inserted: 0, error: null };
  const { error } = await db.from("lecture_chunks").insert(rows);
  return { inserted: error ? 0 : rows.length, error: error?.message ?? null };
}
