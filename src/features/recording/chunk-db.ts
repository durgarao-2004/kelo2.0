/**
 * Browser-only durable store for in-progress recordings. IndexedDB is the
 * right tool here (not localStorage): it stores Blobs natively without a
 * base64 round-trip, it's async so large writes don't block the recording
 * UI, and its quota is large enough to hold a full lecture's audio, unlike
 * localStorage's ~5-10MB synchronous string-only quota.
 *
 * This is what makes a recording survive a refresh, tab close, or crash:
 * every chunk MediaRecorder produces is written here immediately, before
 * (and independent of) any network upload.
 */
const DB_NAME = "kelo-recording";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const CHUNKS_STORE = "chunks";

export interface StoredSession {
  id: string;
  subjectId: string;
  title: string | null;
  mimeType: string;
  ext: string;
  status: "recording" | "stopped";
  elapsedSeconds: number;
  chunkCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface StoredChunk {
  sessionId: string;
  index: number;
  blob: Blob;
  uploaded: boolean;
  createdAt: number;
}

function isSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const store = db.createObjectStore(CHUNKS_STORE, {
          keyPath: ["sessionId", "index"],
        });
        store.createIndex("bySession", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb_open_failed"));
  });
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexeddb_request_failed"));
  });
}

export async function createSession(session: StoredSession): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  tx.objectStore(SESSIONS_STORE).put(session);
  await promisifyRequest(tx.objectStore(SESSIONS_STORE).get(session.id));
  db.close();
}

export async function updateSessionProgress(
  id: string,
  elapsedSeconds: number,
  chunkCount: number,
): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  const store = tx.objectStore(SESSIONS_STORE);
  const existing = await promisifyRequest(store.get(id));
  if (existing) {
    store.put({ ...existing, elapsedSeconds, chunkCount, updatedAt: Date.now() });
  }
  db.close();
}

export async function markSessionStopped(id: string): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  const store = tx.objectStore(SESSIONS_STORE);
  const existing = await promisifyRequest(store.get(id));
  if (existing) {
    store.put({ ...existing, status: "stopped", updatedAt: Date.now() });
  }
  db.close();
}

/** Most recent leftover session (from before a refresh/crash), if any. */
export async function getRecoverableSession(
  excludeId?: string,
): Promise<StoredSession | null> {
  if (!isSupported()) return null;
  const db = await openDb();
  const tx = db.transaction(SESSIONS_STORE, "readonly");
  const all = (await promisifyRequest(
    tx.objectStore(SESSIONS_STORE).getAll(),
  )) as StoredSession[];
  db.close();
  const candidates = all
    .filter((s) => s.id !== excludeId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return candidates[0] ?? null;
}

export async function saveChunk(
  sessionId: string,
  index: number,
  blob: Blob,
): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readwrite");
  const chunk: StoredChunk = {
    sessionId,
    index,
    blob,
    uploaded: false,
    createdAt: Date.now(),
  };
  tx.objectStore(CHUNKS_STORE).put(chunk);
  await promisifyRequest(tx.objectStore(CHUNKS_STORE).get([sessionId, index]));
  db.close();
}

export async function getPendingChunks(
  sessionId: string,
): Promise<{ index: number; blob: Blob }[]> {
  if (!isSupported()) return [];
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readonly");
  const index = tx.objectStore(CHUNKS_STORE).index("bySession");
  const all = (await promisifyRequest(
    index.getAll(IDBKeyRange.only(sessionId)),
  )) as StoredChunk[];
  db.close();
  return all
    .filter((c) => !c.uploaded)
    .sort((a, b) => a.index - b.index)
    .map((c) => ({ index: c.index, blob: c.blob }));
}

export async function markChunkUploaded(
  sessionId: string,
  index: number,
): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readwrite");
  const store = tx.objectStore(CHUNKS_STORE);
  const existing = (await promisifyRequest(
    store.get([sessionId, index]),
  )) as StoredChunk | undefined;
  if (existing) {
    store.put({ ...existing, uploaded: true });
  }
  db.close();
}

/** Force a chunk back into the pending queue (server reported it missing). */
export async function markChunkPending(
  sessionId: string,
  index: number,
): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction(CHUNKS_STORE, "readwrite");
  const store = tx.objectStore(CHUNKS_STORE);
  const existing = (await promisifyRequest(
    store.get([sessionId, index]),
  )) as StoredChunk | undefined;
  if (existing) {
    store.put({ ...existing, uploaded: false });
  }
  db.close();
}

/** Remove a session and every chunk belonging to it (finalize succeeded, or the user chose to discard it). */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!isSupported()) return;
  const db = await openDb();
  const tx = db.transaction([SESSIONS_STORE, CHUNKS_STORE], "readwrite");
  tx.objectStore(SESSIONS_STORE).delete(sessionId);
  const chunkIndex = tx.objectStore(CHUNKS_STORE).index("bySession");
  const cursorReq = chunkIndex.openCursor(IDBKeyRange.only(sessionId));
  await new Promise<void>((resolve, reject) => {
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error ?? new Error("cursor_failed"));
  });
  db.close();
}
