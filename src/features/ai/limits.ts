/**
 * Provider-imposed hard limits, checked before spending a network round trip
 * on a request that's guaranteed to be rejected. Long lectures are the whole
 * point of this app, so a request that's simply too big for a given provider
 * must fail fast with a clear reason rather than a cryptic 413.
 */

/** Groq's OpenAI-compatible audio transcription endpoint caps uploads at 25MB. */
export const GROQ_WHISPER_MAX_BYTES = 25 * 1024 * 1024;

export function exceedsGroqWhisperLimit(byteLength: number): boolean {
  return byteLength > GROQ_WHISPER_MAX_BYTES;
}

const MAX_ANALYSIS_TRANSCRIPT_CHARS = 100_000;

/**
 * Bound how much transcript text is sent to the analysis model per call.
 * ~100k chars (~25k tokens) comfortably covers even a multi-hour lecture on
 * every configured provider's context window; only a genuinely extreme,
 * continuous, multi-hour single recording would ever hit this ceiling.
 */
export function clipForAnalysis(
  text: string,
  maxChars = MAX_ANALYSIS_TRANSCRIPT_CHARS,
): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
