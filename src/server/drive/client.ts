import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fullFolderPlan,
  pathString,
  LEAF_FOLDERS,
  type FolderPlanInput,
  type LeafFolder,
} from "@/features/drive/folder-plan";

const FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function escapeQuery(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string | null> {
  const q = [
    `name = '${escapeQuery(name)}'`,
    `'${parentId}' in parents`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ].join(" and ");
  const url = `${FILES_ENDPOINT}?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive list failed (${res.status}).`);
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string> {
  const res = await fetch(`${FILES_ENDPOINT}?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    }),
  });
  if (!res.ok) throw new Error(`Drive folder create failed (${res.status}).`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string> {
  return (
    (await findFolder(accessToken, name, parentId)) ??
    (await createFolder(accessToken, name, parentId))
  );
}

export interface EnsuredTree {
  rootFolderId: string;
  leaves: Record<LeafFolder, string>;
}

/**
 * Ensure the full KELO/YEAR/SEMESTER/SUBJECT/{leaves} tree exists, creating any
 * missing folders and caching every folder id in `drive_folders` to avoid
 * duplicate lookups/creates. Returns the leaf folder ids.
 */
export async function ensureFolderTree(
  userId: string,
  accessToken: string,
  input: FolderPlanInput,
): Promise<EnsuredTree> {
  const db = getSupabaseAdmin();
  const { data: cachedRows } = await db
    .from("drive_folders")
    .select("path, drive_folder_id")
    .eq("user_id", userId);
  const cache = new Map<string, string>(
    (cachedRows ?? []).map((r) => [r.path, r.drive_folder_id]),
  );

  const plan = fullFolderPlan(input);
  for (const segments of plan) {
    const key = pathString(segments);
    if (cache.has(key)) continue;
    const name = segments[segments.length - 1];
    const parentId =
      segments.length === 1
        ? "root"
        : cache.get(pathString(segments.slice(0, -1)))!;
    const id = await findOrCreateFolder(accessToken, name, parentId);
    cache.set(key, id);
    await db
      .from("drive_folders")
      .upsert(
        { user_id: userId, path: key, drive_folder_id: id },
        { onConflict: "user_id,path" },
      );
  }

  const base = pathString(plan[3]); // KELO/YEAR/SEMESTER/SUBJECT
  const leaves = Object.fromEntries(
    LEAF_FOLDERS.map((leaf) => [leaf, cache.get(`${base}/${leaf}`)!]),
  ) as Record<LeafFolder, string>;

  return { rootFolderId: cache.get("KELO")!, leaves };
}

export async function ensureRootFolder(accessToken: string): Promise<string> {
  return findOrCreateFolder(accessToken, "KELO", "root");
}

/** Download a Drive file's bytes by id. */
export async function downloadFile(
  accessToken: string,
  fileId: string,
): Promise<ArrayBuffer> {
  const res = await fetch(
    `${FILES_ENDPOINT}/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Drive download failed (${res.status}).`);
  return res.arrayBuffer();
}

/** Upload a file (multipart) into a folder; returns the Drive file id. */
export async function uploadFile(
  accessToken: string,
  parentId: string,
  name: string,
  mimeType: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const boundary = `kelo${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.byteLength + tail.length);
  body.set(head, 0);
  body.set(new Uint8Array(bytes), head.length);
  body.set(tail, head.length + bytes.byteLength);

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed (${res.status}).`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Upload UTF-8 text content (transcripts, summaries) into a folder. */
export async function uploadTextFile(
  accessToken: string,
  parentId: string,
  name: string,
  text: string,
  mimeType = "text/plain",
): Promise<string> {
  return uploadFile(
    accessToken,
    parentId,
    name,
    mimeType,
    new TextEncoder().encode(text).buffer as ArrayBuffer,
  );
}
