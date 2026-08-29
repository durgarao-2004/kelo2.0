import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/auth/current-user";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "@/server/drive/oauth";
import { ensureRootFolder } from "@/server/drive/client";
import { saveConnection } from "@/server/drive/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const settings = new URL("/settings", req.url);

  const fail = (reason: string) => {
    settings.searchParams.set("drive", reason);
    const res = NextResponse.redirect(settings);
    res.cookies.delete("drive_oauth_state");
    return res;
  };

  if (oauthError || !code || !state) return fail("error");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const store = await cookies();
  const expected = store.get("drive_oauth_state")?.value;
  if (expected !== `${user.id}:${state}`) return fail("error");

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchGoogleEmail(tokens.accessToken);
    const rootFolderId = await ensureRootFolder(tokens.accessToken);
    await saveConnection({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      googleEmail: email,
      rootFolderId,
    });
  } catch {
    return fail("error");
  }

  settings.searchParams.set("drive", "connected");
  const res = NextResponse.redirect(settings);
  res.cookies.delete("drive_oauth_state");
  return res;
}
