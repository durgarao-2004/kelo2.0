import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";
import { refreshAccessToken } from "./oauth";

type DriveConnectionInsert =
  Database["public"]["Tables"]["drive_connections"]["Insert"];

export interface SaveConnectionInput {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string | null;
  googleEmail: string | null;
  rootFolderId?: string | null;
}

export async function saveConnection(input: SaveConnectionInput): Promise<void> {
  const db = getSupabaseAdmin();
  const row: DriveConnectionInsert = {
    user_id: input.userId,
    access_token_enc: encryptToken(input.accessToken),
    token_expiry: input.expiresAt,
    scope: input.scope,
    google_email: input.googleEmail,
  };
  // Only overwrite the refresh token when Google returns a fresh one.
  if (input.refreshToken) {
    row.refresh_token_enc = encryptToken(input.refreshToken);
  }
  if (input.rootFolderId !== undefined) {
    row.root_folder_id = input.rootFolderId;
  }
  await db.from("drive_connections").upsert(row, { onConflict: "user_id" });
}

export async function setRootFolder(
  userId: string,
  rootFolderId: string,
): Promise<void> {
  await getSupabaseAdmin()
    .from("drive_connections")
    .update({ root_folder_id: rootFolderId })
    .eq("user_id", userId);
}

export async function disconnect(userId: string): Promise<void> {
  const db = getSupabaseAdmin();
  await db.from("drive_folders").delete().eq("user_id", userId);
  await db.from("drive_connections").delete().eq("user_id", userId);
}

export class DriveNotConnectedError extends Error {
  constructor(public readonly needsReauth = false) {
    super(needsReauth ? "reauth_required" : "drive_not_connected");
  }
}

/**
 * Return a valid access token, refreshing it (and persisting the new one) when
 * it's within 60s of expiry. Throws DriveNotConnectedError when there's no
 * connection or no usable refresh token.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("drive_connections")
    .select("access_token_enc, refresh_token_enc, token_expiry, scope")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) throw new DriveNotConnectedError(false);

  const expiryMs = data.token_expiry
    ? new Date(data.token_expiry).getTime()
    : 0;
  if (expiryMs - Date.now() > 60_000) {
    return decryptToken(data.access_token_enc);
  }

  if (!data.refresh_token_enc) throw new DriveNotConnectedError(true);
  const refreshed = await refreshAccessToken(
    decryptToken(data.refresh_token_enc),
  );
  await db
    .from("drive_connections")
    .update({
      access_token_enc: encryptToken(refreshed.accessToken),
      token_expiry: refreshed.expiresAt,
    })
    .eq("user_id", userId);
  return refreshed.accessToken;
}
