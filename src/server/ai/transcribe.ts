import "server-only";
import { getServerEnv } from "@/lib/env";
import { ProviderError, withRetries, isRetryableHttpStatus } from "@/features/ai/retry";
import { exceedsGroqWhisperLimit, GROQ_WHISPER_MAX_BYTES } from "@/features/ai/limits";
import {
  extractUploadUrl,
  extractJobId,
  pollUntilDone,
  transcriptionProviderOrder,
  type AssemblyAiPollResponse,
} from "@/features/ai/assemblyai";

export interface TranscriptionResult {
  text: string;
  provider: string;
}

const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 3_000;
// Long lectures can take a while to transcribe; keep this comfortably under
// the process route's maxDuration so a slow-but-healthy job still finishes
// instead of racing the platform's own hard timeout.
const POLL_TIMEOUT_MS = 6 * 60_000; // 6 minutes

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

// ---------- AssemblyAI (primary) ----------

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

async function assemblyAiUpload(bytes: ArrayBuffer, apiKey: string): Promise<string> {
  return withRetries(
    async () => {
      const res = await fetchWithTimeout(
        `${ASSEMBLYAI_BASE}/upload`,
        {
          method: "POST",
          headers: { authorization: apiKey, "content-type": "application/octet-stream" },
          body: bytes,
        },
        UPLOAD_TIMEOUT_MS,
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `assemblyai upload ${res.status}: ${detail.slice(0, 200)}`,
          isRetryableHttpStatus(res.status),
        );
      }
      return extractUploadUrl((await res.json()) as { upload_url?: string });
    },
    (e) => e instanceof ProviderError && e.retryable,
  );
}

async function assemblyAiCreateJob(uploadUrl: string, apiKey: string): Promise<string> {
  return withRetries(
    async () => {
      const res = await fetchWithTimeout(`${ASSEMBLYAI_BASE}/transcript`, {
        method: "POST",
        headers: { authorization: apiKey, "content-type": "application/json" },
        body: JSON.stringify({ audio_url: uploadUrl }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `assemblyai transcript-create ${res.status}: ${detail.slice(0, 200)}`,
          isRetryableHttpStatus(res.status),
        );
      }
      return extractJobId((await res.json()) as { id?: string });
    },
    (e) => e instanceof ProviderError && e.retryable,
  );
}

async function assemblyAiPollOnce(jobId: string, apiKey: string): Promise<AssemblyAiPollResponse> {
  return withRetries(
    async () => {
      const res = await fetchWithTimeout(`${ASSEMBLYAI_BASE}/transcript/${jobId}`, {
        headers: { authorization: apiKey },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `assemblyai poll ${res.status}: ${detail.slice(0, 200)}`,
          isRetryableHttpStatus(res.status),
        );
      }
      return (await res.json()) as AssemblyAiPollResponse;
    },
    (e) => e instanceof ProviderError && e.retryable,
  );
}

async function assemblyAiTranscribe(bytes: ArrayBuffer, apiKey: string): Promise<string> {
  const uploadUrl = await assemblyAiUpload(bytes, apiKey);
  const jobId = await assemblyAiCreateJob(uploadUrl, apiKey);
  return pollUntilDone(() => assemblyAiPollOnce(jobId, apiKey), {
    intervalMs: POLL_INTERVAL_MS,
    timeoutMs: POLL_TIMEOUT_MS,
  });
}

// ---------- Groq Whisper (fallback) ----------
// Groq exposes an OpenAI-compatible audio transcription endpoint.

async function groqWhisper(
  bytes: ArrayBuffer,
  mimeType: string,
  model: string,
  apiKey: string,
): Promise<string> {
  if (exceedsGroqWhisperLimit(bytes.byteLength)) {
    // Fail fast and clearly instead of burning a request on a guaranteed
    // 413 — long lectures are the norm here, not an edge case.
    throw new ProviderError(
      `audio too large for Groq Whisper (${(bytes.byteLength / (1024 * 1024)).toFixed(1)}MB > ${GROQ_WHISPER_MAX_BYTES / (1024 * 1024)}MB limit)`,
      false,
    );
  }
  return withRetries(
    async () => {
      const form = new FormData();
      const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
      form.append("file", new Blob([bytes], { type: mimeType }), `audio.${ext}`);
      form.append("model", model);
      const res = await fetchWithTimeout(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        },
        UPLOAD_TIMEOUT_MS,
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `groq-whisper ${res.status}: ${detail.slice(0, 200)}`,
          isRetryableHttpStatus(res.status),
        );
      }
      const data = (await res.json()) as { text?: string };
      return data.text ?? "";
    },
    (e) => e instanceof ProviderError && e.retryable,
  );
}

/**
 * Transcribe audio using the best available provider: AssemblyAI (primary,
 * upload → job → poll) with Groq Whisper as fallback. Gemini/OpenAI are
 * NEVER used here — they're reserved for lecture analysis. Throws a precise,
 * actionable error if no provider is configured or all fail; never returns a
 * fabricated transcript.
 */
export async function transcribeAudio(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  const env = getServerEnv();
  const order = transcriptionProviderOrder({
    assemblyai: Boolean(env.ASSEMBLYAI_API_KEY),
    groq: Boolean(env.GROQ_API_KEY),
  });

  if (order.length === 0) {
    throw new Error(
      "no_transcription_provider: set ASSEMBLYAI_API_KEY (primary) and/or GROQ_API_KEY (fallback) to enable transcription.",
    );
  }

  const errors: string[] = [];
  for (const provider of order) {
    try {
      const text =
        provider === "assemblyai"
          ? await assemblyAiTranscribe(bytes, env.ASSEMBLYAI_API_KEY!)
          : await groqWhisper(bytes, mimeType, env.GROQ_MODEL, env.GROQ_API_KEY!);
      if (text.trim()) return { text, provider };
      errors.push(`${provider}: empty transcript`);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${provider} failed`);
    }
  }
  throw new Error(`transcription failed: ${errors.join("; ")}`);
}
