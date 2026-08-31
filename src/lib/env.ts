import "server-only";
import { z } from "zod";

/**
 * Server-only environment. NEVER import this from a Client Component.
 * Values are validated lazily so a missing variable produces a clear,
 * secret-free diagnostic instead of crashing an unrelated build step.
 */
const serverEnvSchema = z.object({
  // Supabase privileged access (bypasses RLS — server only).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Session cookie signing.
  SESSION_SECRET: z.string().min(32),

  // Google OAuth (Drive connection only — not app login).
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),

  // AI providers (lecture analysis: title/summary/concepts/revision) — each
  // optional; the router requires at least one at runtime.
  GEMINI_API_KEY: z.string().optional(),
  GROK_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  // Transcription providers — separate from the analysis providers above.
  // AssemblyAI is primary; Groq Whisper is the fallback. Neither analysis
  // model (Gemini/OpenAI/etc.) is ever used for transcription.
  ASSEMBLYAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Optional model overrides with sane defaults.
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GROK_MODEL: z.string().default("grok-2-latest"),
  OPENROUTER_MODEL: z.string().default("meta-llama/llama-3.1-70b-instruct"),
  GROQ_MODEL: z.string().default("whisper-large-v3"),

  // Resend (PIN recovery email delivery only — never used for login).
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("KELO <onboarding@resend.dev>"),

  // Web Push (VAPID). All optional at the type level so a deployment without
  // push configured doesn't crash unrelated routes — callers that actually
  // need push must check they're all present (see server/push/vapid.ts).
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  // Shared secret required on /api/push/dispatch (the cron-triggered sender).
  CRON_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names are surfaced — never values.
    const problems = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid server environment configuration. Check these variables: ${problems}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/**
 * Safe, secret-free view of which capabilities are configured.
 * Returns booleans only — suitable for a diagnostics/health endpoint.
 */
export function getServerEnvDiagnostics() {
  const e = process.env;
  return {
    supabaseServiceRole: Boolean(e.SUPABASE_SERVICE_ROLE_KEY),
    sessionSecret: Boolean(e.SESSION_SECRET && e.SESSION_SECRET.length >= 32),
    google: {
      clientSecret: Boolean(e.GOOGLE_OAUTH_CLIENT_SECRET),
      redirectUri: Boolean(e.GOOGLE_OAUTH_REDIRECT_URI),
    },
    ai: {
      gemini: Boolean(e.GEMINI_API_KEY),
      grok: Boolean(e.GROK_API_KEY),
      openai: Boolean(e.OPENAI_API_KEY),
      openrouter: Boolean(e.OPENROUTER_API_KEY),
    },
    transcription: {
      assemblyai: Boolean(e.ASSEMBLYAI_API_KEY),
      groq: Boolean(e.GROQ_API_KEY),
    },
    resend: Boolean(e.RESEND_API_KEY),
    push: Boolean(
      e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY && e.VAPID_SUBJECT,
    ),
  };
}

/** True when at least one AI provider key is present. */
export function hasAnyAiProvider(): boolean {
  const e = process.env;
  return Boolean(
    e.GEMINI_API_KEY ||
      e.GROK_API_KEY ||
      e.OPENAI_API_KEY ||
      e.OPENROUTER_API_KEY,
  );
}
