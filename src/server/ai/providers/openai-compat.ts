import "server-only";
import type {
  GenerateRequest,
  ProviderClient,
  ProviderName,
} from "@/features/ai/types";

/**
 * Client for any OpenAI-compatible chat completions API (OpenAI, xAI/Grok,
 * OpenRouter). They share the same request/response shape.
 */
export function makeOpenAICompatClient(config: {
  name: ProviderName;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  extraHeaders?: Record<string, string>;
}): ProviderClient {
  return {
    name: config.name,
    model: config.model,
    isConfigured: () => Boolean(config.apiKey),
    async generate(req: GenerateRequest): Promise<string> {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 1024,
      };
      if (req.json) body.response_format = { type: "json_object" };

      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...config.extraHeaders,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`${config.name} ${res.status}: ${detail.slice(0, 160)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}
