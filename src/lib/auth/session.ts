import { SignJWT, jwtVerify } from "jose";

/**
 * Stateless signed-session tokens (HS256 via SESSION_SECRET). Edge-safe (jose),
 * so this module is importable from middleware as well as Node route handlers.
 * The token binds a user id (`sub`) and their `session_version` (`sv`) so that
 * bumping the version server-side invalidates all outstanding sessions.
 */
export const SESSION_COOKIE = "kelo_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const ALG = "HS256";

export interface SessionPayload {
  /** user id */
  sub: string;
  /** session version */
  sv: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sv: payload.sv })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + maxAgeSeconds)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: [ALG],
    });
    if (typeof payload.sub !== "string") return null;
    const sv = typeof payload.sv === "number" ? payload.sv : Number(payload.sv);
    if (!Number.isFinite(sv)) return null;
    return { sub: payload.sub, sv };
  } catch {
    return null;
  }
}
