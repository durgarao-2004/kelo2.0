import "server-only";
import { getServerEnv } from "@/lib/env";

export interface TranscriptionResult {
  text: string;
  provider: string;
}

async function whisper(
  bytes: ArrayBuffer,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  form.append("file", new Blob([bytes], { type: mimeType }), `audio.${ext}`);
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

async function geminiTranscribe(
  bytes: ArrayBuffer,
  mimeType: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const base64 = Buffer.from(bytes).toString("base64");
  const res = await fetch(
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
  if (!res.ok) throw new Error(`gemini-transcribe ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  );
}

/**
 * Transcribe audio using the best available provider (OpenAI Whisper first,
 * then Gemini). Throws if none is configured or all fail.
 */
export async function transcribeAudio(
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  const env = getServerEnv();
  const errors: string[] = [];

  if (env.OPENAI_API_KEY) {
    try {
      return { text: await whisper(bytes, mimeType, env.OPENAI_API_KEY), provider: "openai-whisper" };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "whisper failed");
    }
  }
  if (env.GEMINI_API_KEY) {
    try {
      return {
        text: await geminiTranscribe(bytes, mimeType, env.GEMINI_MODEL, env.GEMINI_API_KEY),
        provider: "gemini",
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "gemini failed");
    }
  }
  throw new Error(
    errors.length ? `transcription failed: ${errors.join("; ")}` : "no_transcription_provider",
  );
}
