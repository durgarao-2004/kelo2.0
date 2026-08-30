import { uploadWithRetry } from "./upload";

/**
 * Drains a per-chunk upload queue: pure orchestration over injected
 * store/transport adapters so it's testable without real IndexedDB or
 * network. This is what turns "one giant upload at the end" into
 * independent, retryable, resumable per-chunk uploads.
 */
export interface QueuedChunk {
  index: number;
  blob: Blob;
}

export interface ChunkStoreAdapter {
  /** Chunks not yet confirmed uploaded, ascending by index. */
  getPendingChunks(): Promise<QueuedChunk[]>;
  markUploaded(index: number): Promise<void>;
}

export interface ChunkTransport {
  uploadChunk(chunk: QueuedChunk): Promise<void>;
}

export interface DrainOptions {
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Checked before each chunk; when false, stop without touching the network. */
  isOnline?: () => boolean;
  onChunkUploaded?: (index: number) => void;
}

export interface DrainResult {
  ok: boolean;
  uploadedCount: number;
  error?: string;
}

export async function drainChunkQueue(
  store: ChunkStoreAdapter,
  transport: ChunkTransport,
  options: DrainOptions = {},
): Promise<DrainResult> {
  let uploadedCount = 0;

  for (;;) {
    if (options.isOnline && !options.isOnline()) {
      return { ok: false, uploadedCount, error: "offline" };
    }

    const pending = await store.getPendingChunks();
    if (pending.length === 0) return { ok: true, uploadedCount };

    const chunk = pending[0];
    const result = await uploadWithRetry(() => transport.uploadChunk(chunk), {
      retries: options.retries,
      baseDelayMs: options.baseDelayMs,
      sleep: options.sleep,
    });

    if (!result.ok) {
      return { ok: false, uploadedCount, error: result.error };
    }

    await store.markUploaded(chunk.index);
    options.onChunkUploaded?.(chunk.index);
    uploadedCount++;
  }
}
