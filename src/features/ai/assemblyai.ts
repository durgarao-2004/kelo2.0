/**
 * Pure AssemblyAI response parsing/polling logic — no fetch, no timers unless
 * injected — so it's fully unit-testable. The server-only wrapper
 * (server/ai/transcribe.ts) supplies the real HTTP calls and timing.
 */
export interface AssemblyAiUploadResponse {
  upload_url?: string;
}

export interface AssemblyAiJobResponse {
  id?: string;
}

export interface AssemblyAiPollResponse {
  status?: string;
  text?: string;
  error?: string;
}

export type AssemblyAiPollResult =
  | { kind: "completed"; text: string }
  | { kind: "processing" }
  | { kind: "failed"; message: string };

/** AssemblyAI transcript jobs move through queued -> processing -> completed|error. */
export function interpretAssemblyAiPoll(data: AssemblyAiPollResponse): AssemblyAiPollResult {
  if (data.status === "completed") return { kind: "completed", text: data.text ?? "" };
  if (data.status === "error") {
    return { kind: "failed", message: data.error?.trim() || "unknown error" };
  }
  return { kind: "processing" };
}

export function extractUploadUrl(data: AssemblyAiUploadResponse): string {
  if (!data.upload_url) {
    throw new Error("assemblyai upload: malformed response (missing upload_url)");
  }
  return data.upload_url;
}

export function extractJobId(data: AssemblyAiJobResponse): string {
  if (!data.id) {
    throw new Error("assemblyai transcript-create: malformed response (missing id)");
  }
  return data.id;
}

export interface PollUntilDoneOptions {
  intervalMs: number;
  timeoutMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Poll `poll()` until the job completes, fails, or `timeoutMs` elapses.
 * `now`/`sleep` are injectable so the timeout/backoff behavior is testable
 * without real timers.
 */
export async function pollUntilDone(
  poll: () => Promise<AssemblyAiPollResponse>,
  options: PollUntilDoneOptions,
): Promise<string> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const deadline = now() + options.timeoutMs;
  let lastStatus = "queued";

  while (now() < deadline) {
    const data = await poll();
    const result = interpretAssemblyAiPoll(data);
    if (result.kind === "completed") return result.text;
    if (result.kind === "failed") {
      throw new Error(`assemblyai job failed: ${result.message}`);
    }
    lastStatus = data.status ?? "unknown";
    await sleep(options.intervalMs);
  }
  throw new Error(`assemblyai polling timed out after ${options.timeoutMs}ms (last status: ${lastStatus})`);
}

export type TranscriptionProviderName = "assemblyai" | "groq-whisper";

/**
 * AssemblyAI is always primary when configured; Groq Whisper is the fallback.
 * Gemini is deliberately never a transcription provider — it's reserved for
 * lecture analysis (title/summary/concepts/revision).
 */
export function transcriptionProviderOrder(config: {
  assemblyai: boolean;
  groq: boolean;
}): TranscriptionProviderName[] {
  const order: TranscriptionProviderName[] = [];
  if (config.assemblyai) order.push("assemblyai");
  if (config.groq) order.push("groq-whisper");
  return order;
}
