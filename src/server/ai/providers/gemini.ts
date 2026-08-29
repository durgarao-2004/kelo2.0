import "server-only";
import type { GenerateRequest, ProviderClient } from "@/features/ai/types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Google Gemini generateContent client. */
export function makeGeminiClient(
  apiKey: string | undefined,
  model: string,
): ProviderClient {
  return {
    name: "gemini",
    model,
    isConfigured: () => Boolean(apiKey),
    async generate(req: GenerateRequest): Promise<string> {
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> =
        [];
      let systemInstruction: { parts: Array<{ text: string }> } | undefined;

      for (const m of req.messages) {
        if (m.role === "system") {
          systemInstruction = { parts: [{ text: m.content }] };
          continue;
        }
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: req.temperature ?? 0.4,
          maxOutputTokens: req.maxTokens ?? 1024,
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
      };
      if (systemInstruction) body.systemInstruction = systemInstruction;

      const res = await fetch(
        `${BASE}/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`gemini ${res.status}: ${detail.slice(0, 160)}`);
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      return (
        data.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? ""
      );
    },
  };
}
