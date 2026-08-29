import "server-only";
import { getServerEnv } from "@/lib/env";
import type { ProviderClient, ProviderName } from "@/features/ai/types";
import { makeOpenAICompatClient } from "./providers/openai-compat";
import { makeGeminiClient } from "./providers/gemini";

/** Build the provider clients from server env (keys are server-only). */
export function buildAiClients(): Partial<Record<ProviderName, ProviderClient>> {
  const env = getServerEnv();
  return {
    gemini: makeGeminiClient(env.GEMINI_API_KEY, env.GEMINI_MODEL),
    grok: makeOpenAICompatClient({
      name: "grok",
      baseUrl: "https://api.x.ai/v1",
      apiKey: env.GROK_API_KEY,
      model: env.GROK_MODEL,
    }),
    openai: makeOpenAICompatClient({
      name: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    }),
    openrouter: makeOpenAICompatClient({
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      extraHeaders: { "X-Title": "KELO" },
    }),
  };
}
