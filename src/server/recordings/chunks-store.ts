import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "recording-chunks";

function objectPath(sessionId: string, chunkIndex: number): string {
  return `${sessionId}/${chunkIndex}`;
}

/**
 * Stage one chunk's bytes in Storage and record its metadata. Idempotent:
 * re-uploading the same (session, index) overwrites in place — no duplicate
 * objects, no duplicate rows.
 */
export async function storeChunk(
  sessionId: string,
  chunkIndex: number,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(objectPath(sessionId, chunkIndex), bytes, {
      contentType,
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`chunk_storage_failed: ${uploadError.message}`);
  }
  const { error: metaError } = await db.from("recording_chunk_meta").upsert(
    { session_id: sessionId, chunk_index: chunkIndex, size_bytes: bytes.byteLength },
    { onConflict: "session_id,chunk_index" },
  );
  if (metaError) {
    throw new Error(`chunk_meta_failed: ${metaError.message}`);
  }
}

/** All chunk indexes currently staged for a session, ascending. */
export async function listChunkIndexes(sessionId: string): Promise<number[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("recording_chunk_meta")
    .select("chunk_index")
    .eq("session_id", sessionId)
    .order("chunk_index", { ascending: true });
  if (error) throw new Error(`chunk_list_failed: ${error.message}`);
  return (data ?? []).map((r) => r.chunk_index);
}

/** Download and concatenate chunks in order into one buffer. */
export async function downloadChunksInOrder(
  sessionId: string,
  indexes: number[],
): Promise<Uint8Array> {
  const db = getSupabaseAdmin();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const index of indexes) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .download(objectPath(sessionId, index));
    if (error || !data) {
      throw new Error(`chunk_download_failed:${index}: ${error?.message ?? "missing"}`);
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    parts.push(bytes);
    total += bytes.byteLength;
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }
  return combined;
}

/** Remove every staged chunk (bytes + metadata) for a finished session. */
export async function deleteSessionChunks(
  sessionId: string,
  indexes: number[],
): Promise<void> {
  const db = getSupabaseAdmin();
  if (indexes.length > 0) {
    await db.storage
      .from(BUCKET)
      .remove(indexes.map((i) => objectPath(sessionId, i)));
  }
  await db.from("recording_chunk_meta").delete().eq("session_id", sessionId);
}
