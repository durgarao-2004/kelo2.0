import { describe, it, expect } from "vitest";
import { drainChunkQueue, type QueuedChunk } from "./upload-queue";

const noSleep = () => Promise.resolve();

function makeBlob(): Blob {
  return new Blob(["x"]);
}

/** In-memory fake standing in for the IndexedDB-backed adapter. */
class FakeStore {
  private chunks: Map<number, QueuedChunk>;
  constructor(indexes: number[]) {
    this.chunks = new Map(indexes.map((i) => [i, { index: i, blob: makeBlob() }]));
  }
  async getPendingChunks(): Promise<QueuedChunk[]> {
    return [...this.chunks.values()].sort((a, b) => a.index - b.index);
  }
  async markUploaded(index: number): Promise<void> {
    this.chunks.delete(index);
  }
  remaining(): number[] {
    return [...this.chunks.keys()].sort((a, b) => a - b);
  }
}

describe("drainChunkQueue", () => {
  it("uploads every pending chunk in ascending index order", async () => {
    const store = new FakeStore([2, 0, 1]);
    const order: number[] = [];
    const result = await drainChunkQueue(
      store,
      { uploadChunk: async (c) => void order.push(c.index) },
      { sleep: noSleep },
    );
    expect(result).toEqual({ ok: true, uploadedCount: 3 });
    expect(order).toEqual([0, 1, 2]);
    expect(store.remaining()).toEqual([]);
  });

  it("retries a flaky chunk before succeeding", async () => {
    const store = new FakeStore([0]);
    let attempts = 0;
    const result = await drainChunkQueue(
      store,
      {
        uploadChunk: async () => {
          attempts++;
          if (attempts < 3) throw new Error("network blip");
        },
      },
      { retries: 3, sleep: noSleep },
    );
    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
  });

  it("stops at the first unrecoverable failure and leaves later chunks resumable", async () => {
    const store = new FakeStore([0, 1, 2]);
    const uploaded: number[] = [];
    const result = await drainChunkQueue(
      store,
      {
        uploadChunk: async (c) => {
          if (c.index === 1) throw new Error("server down");
          uploaded.push(c.index);
        },
      },
      { retries: 0, sleep: noSleep },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("server down");
    expect(uploaded).toEqual([0]);
    // Chunk 0 uploaded and removed; 1 and 2 remain pending for the next drain.
    expect(store.remaining()).toEqual([1, 2]);
  });

  it("never re-uploads a chunk once it's marked uploaded (dedupe across drains)", async () => {
    const store = new FakeStore([0, 1]);
    let calls = 0;
    const transport = { uploadChunk: async () => void calls++ };

    const first = await drainChunkQueue(store, transport, { sleep: noSleep });
    expect(first).toEqual({ ok: true, uploadedCount: 2 });
    expect(calls).toBe(2);

    // Simulate calling drain again later (e.g. after a page reload) with
    // nothing new pending — must not touch the network again.
    const second = await drainChunkQueue(store, transport, { sleep: noSleep });
    expect(second).toEqual({ ok: true, uploadedCount: 0 });
    expect(calls).toBe(2);
  });

  it("resumes only the unfinished remainder after a prior partial failure", async () => {
    const store = new FakeStore([0, 1, 2]);
    let shouldFail = true;
    const attemptedIndexes: number[] = [];
    const transport = {
      uploadChunk: async (c: QueuedChunk) => {
        attemptedIndexes.push(c.index);
        if (c.index === 1 && shouldFail) throw new Error("still down");
      },
    };

    const first = await drainChunkQueue(store, transport, { retries: 0, sleep: noSleep });
    expect(first.ok).toBe(false);
    expect(store.remaining()).toEqual([1, 2]);

    shouldFail = false;
    attemptedIndexes.length = 0;
    const second = await drainChunkQueue(store, transport, { sleep: noSleep });
    expect(second).toEqual({ ok: true, uploadedCount: 2 });
    // Chunk 0 was never attempted again — resume picked up exactly where it left off.
    expect(attemptedIndexes).toEqual([1, 2]);
  });

  it("does not touch the network at all while offline", async () => {
    const store = new FakeStore([0, 1]);
    let calls = 0;
    const result = await drainChunkQueue(
      store,
      { uploadChunk: async () => void calls++ },
      { isOnline: () => false, sleep: noSleep },
    );
    expect(result).toEqual({ ok: false, uploadedCount: 0, error: "offline" });
    expect(calls).toBe(0);
  });

  it("treats an empty queue as already complete", async () => {
    const store = new FakeStore([]);
    const result = await drainChunkQueue(
      store,
      { uploadChunk: async () => {} },
      { sleep: noSleep },
    );
    expect(result).toEqual({ ok: true, uploadedCount: 0 });
  });
});
