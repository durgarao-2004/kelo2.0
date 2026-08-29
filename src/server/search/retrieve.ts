import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface RetrievedChunk {
  chunkId: string;
  lectureId: string;
  source: string;
  content: string;
  rank: number;
  lectureTitle: string;
  recordedAt: string | null;
  subjectName: string | null;
}

/**
 * Retrieve the most relevant lecture chunks for a query using the Postgres
 * full-text RPC (search_lecture_chunks), scoped to the user, then enrich with
 * lecture/subject labels for citation. This is the retrieval step of RAG — only
 * the top matches are sent to the model, never the whole database.
 */
export async function retrieveChunks(
  userId: string,
  query: string,
  limit = 6,
): Promise<{ data: RetrievedChunk[]; error: string | null }> {
  const trimmed = query.trim();
  if (!trimmed) return { data: [], error: null };

  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("search_lecture_chunks", {
    p_user_id: userId,
    p_query: trimmed,
    p_limit: limit,
  });
  if (error) return { data: [], error: error.message };

  const rows = data ?? [];
  const lectureIds = [...new Set(rows.map((r) => r.lecture_id))];
  const labels = new Map<
    string,
    { title: string; recordedAt: string | null; subjectName: string | null }
  >();

  if (lectureIds.length > 0) {
    const { data: lecturesRaw } = await db
      .from("lectures")
      .select("id, title, recorded_at, subject:subjects(name)")
      .eq("user_id", userId)
      .in("id", lectureIds);
    const lectures = (lecturesRaw ?? []) as unknown as Array<{
      id: string;
      title: string | null;
      recorded_at: string | null;
      subject: { name: string } | { name: string }[] | null;
    }>;
    for (const l of lectures) {
      const subject = l.subject;
      const subjectName = Array.isArray(subject)
        ? (subject[0]?.name ?? null)
        : (subject?.name ?? null);
      labels.set(l.id, {
        title: l.title ?? "Untitled lecture",
        recordedAt: l.recorded_at,
        subjectName,
      });
    }
  }

  return {
    data: rows.map((r) => {
      const label = labels.get(r.lecture_id);
      return {
        chunkId: r.chunk_id,
        lectureId: r.lecture_id,
        source: r.source,
        content: r.content,
        rank: r.rank,
        lectureTitle: label?.title ?? "Untitled lecture",
        recordedAt: label?.recordedAt ?? null,
        subjectName: label?.subjectName ?? null,
      };
    }),
    error: null,
  };
}
