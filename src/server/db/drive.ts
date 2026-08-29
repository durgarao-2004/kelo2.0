import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface DriveStatus {
  connected: boolean;
  googleEmail: string | null;
  rootFolderId: string | null;
}

export async function getDriveConnection(
  userId: string,
): Promise<DriveStatus> {
  const { data } = await getSupabaseAdmin()
    .from("drive_connections")
    .select("google_email, root_folder_id")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    connected: Boolean(data),
    googleEmail: data?.google_email ?? null,
    rootFolderId: data?.root_folder_id ?? null,
  };
}
