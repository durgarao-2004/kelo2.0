import "server-only";
import { getServerEnv } from "@/lib/env";
import {
  ProviderError,
  withRetries,
  isRetryableOpenAiStatus,
  isRetryableGeminiStatus,
} from "@/features/ai/retry";

export interface TranscriptionResult {
  text: string;
  provider: string;
}

const REQUEST_TIMEOUT_MS = 90_000;

/** fetch() with a hard timeout, since a hung provider must never hang the pipeline. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ProviderError(`timed out after ${timeoutMs}ms`, true);
    }
    throw new ProviderError(e instanceof Error ? e.message : "network error", true);
  } finally {
    clearTimeout(timer);
  }
}

async function whisper(
  bytes: ArrayBuffer,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  return withRetries(
    async () => {
      const form = new FormData();
      const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
      form.append("file", new Blob([bytes], { type: mimeType }), `audio.${ext}`);
      form.append("model", "whisper-1");
      const res = await fetchWithTimeout("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `whisper ${res.status}: ${detail.slice(0, 200)}`,
          isRetryableOpenAiStatus(res.status, detail),
        );
      }
      const data = (await res.json()) as { text?: string };
      return data.text ?? "";
    },
    (e) => e instanceof ProviderError && e.retryable,
  );
}

async function geminiTranscribe(
  bytes: ArrayBuffer,
  mimeType: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const base64 = Buffer.from(bytes).toString("base64");
  return withRetries(
    async () => {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Transcribe this lecture audio verbatim. Output only the transcript." },
                  { inlineData: { mimeType, data: base64 } },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `gemini-transcribe ${res.status}: ${detail.slice(0, 200)}`,
          isRetryableGeminiStatus(res.status),
        );
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return (
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
      );
    },
    (e) => e instanceof ProviderError && e.retryable,
  );
}

/**
 * Transcribe audio using the best available provider (OpenAI Whisper first,
 * then Gemini). Each provider gets a bounded timeout and retries only on
 * transient errors (rate limits, 5xx) — permanent failures (bad model,
 * expired key, exhausted quota) fail fast to the next provider. Throws if
 * none is configured or all fail; never returns a fabricated transcript.
 */
export async function transcribeAudio(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  const env = getServerEnv();
  const errors: string[] = [];

  if (env.OPENAI_API_KEY) {
    try {
      const text = await whisper(bytes, mimeType, env.OPENAI_API_KEY);
      if (text.trim()) return { text, provider: "openai-whisper" };
      errors.push("openai-whisper: empty transcript");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "whisper failed");
    }
  }
  if (env.GEMINI_API_KEY) {
    try {
      const text = await geminiTranscribe(bytes, mimeType, env.GEMINI_MODEL, env.GEMINI_API_KEY);
      if (text.trim()) return { text, provider: "gemini" };
      errors.push("gemini: empty transcript");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "gemini failed");
    }
  }
  throw new Error(
    errors.length ? `transcription failed: ${errors.join("; ")}` : "no_transcription_provider",
  );
}
