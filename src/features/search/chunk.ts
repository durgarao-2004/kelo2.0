/**
 * Transcript/summary chunking for RAG — pure and testable.
 * Splits on sentence boundaries and packs into ~maxChars windows with a small
 * overlap so retrieval keeps local context.
 */
export interface Chunk {
  index: number;
  content: string;
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  // Split after sentence-ending punctuation followed by whitespace.
  return normalized.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [
    normalized,
  ];
}

function hardSplit(sentence: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < sentence.length; i += maxChars) {
    parts.push(sentence.slice(i, i + maxChars));
  }
  return parts;
}

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxChars = Math.max(200, options.maxChars ?? 1200);
  const overlapChars = Math.max(0, Math.min(options.overlapChars ?? 150, maxChars - 1));

  const sentences = splitSentences(text).flatMap((s) =>
    s.length > maxChars ? hardSplit(s, maxChars) : [s],
  );

  const chunks: Chunk[] = [];
  let buffer = "";

  const flush = () => {
    const content = buffer.trim();
    if (content) chunks.push({ index: chunks.length, content });
  };

  for (const sentence of sentences) {
    if (buffer.length === 0) {
      buffer = sentence;
    } else if (buffer.length + 1 + sentence.length <= maxChars) {
      buffer += ` ${sentence}`;
    } else {
      flush();
      const overlap =
        overlapChars > 0 ? buffer.slice(Math.max(0, buffer.length - overlapChars)) : "";
      buffer = overlap ? `${overlap} ${sentence}` : sentence;
    }
  }
  flush();

  return chunks;
}
