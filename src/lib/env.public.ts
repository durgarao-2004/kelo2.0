import { z } from "zod";

/**
 * Client-safe environment (NEXT_PUBLIC_*). These values are inlined into the
 * browser bundle at build time, so they must be referenced statically.
 * Nothing secret belongs here.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  // Absent when Web Push isn't configured for this deployment — the
  // notifications UI checks this and never claims support it doesn't have.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
});

export const clientEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});

export type ClientEnv = z.infer<typeof publicEnvSchema>;
