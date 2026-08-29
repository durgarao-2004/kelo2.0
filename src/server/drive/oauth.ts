import "server-only";
import { getServerEnv } from "@/lib/env";
import { clientEnv } from "@/lib/env.public";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

// Least-privilege: manage only files/folders KELO creates, plus the email.
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string; // ISO
  scope: string | null;
}

export function buildAuthUrl(state: string): string {
  const env = getServerEnv();
  const params = new URLSearchParams({
    client_id: clientEnv.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: DRIVE_SCOPES.join(" "),
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function expiresAtFrom(expiresInSec: number): string {
  return new Date(Date.now() + expiresInSec * 1000).toISOString();
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const env = getServerEnv();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientEnv.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}).`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: expiresAtFrom(data.expires_in),
    scope: data.scope ?? null,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<Omit<OAuthTokens, "refreshToken">> {
  const env = getServerEnv();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientEnv.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}).`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    expiresAt: expiresAtFrom(data.expires_in),
    scope: data.scope ?? null,
  };
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).catch(() => undefined);
}
